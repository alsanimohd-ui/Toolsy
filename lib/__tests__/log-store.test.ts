import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTER,
  LogStore,
  buildHighlightRegex,
  compileMatcher,
  detectLevel,
  parseTimeInput,
  parseTimestamp,
  type Filter,
} from "../log-store";

const SAMPLE = [
  "[2026-05-03 20:10:15] INFO: Server initialized on port 3000",
  "[192.168.1.45] [2026-05-03 20:10:18] DEBUG: Fetching DB connection pool...",
  "[2026-05-03 20:11:05] WARN: API latency spiked to 450ms on endpoint /api/users",
  "[10.0.5.22] [2026-05-03 20:14:11] ERROR: Auth failed for admin@maker-ai.tech",
  "[10.0.5.22] [2026-05-03 20:14:12] ERROR: Auth failed for admin@maker-ai.tech",
  "[10.0.5.22] [2026-05-03 20:14:12] ERROR: Auth failed for admin@maker-ai.tech",
  "[10.0.5.22] [2026-05-03 20:14:13] ERROR: Auth failed for admin@maker-ai.tech",
  "[2026-05-03 20:15:10] CRITICAL: system crash detected - OutOfMemoryError",
  "    at Server.handleRequest (/usr/src/app/server.js:45:12)",
  "    at async Server.listen (/usr/src/app/server.js:10:3)",
  "[2026-05-03 20:16:00] timeout occurred during upstream request",
  "[2026-05-03 20:16:00] connection refused by 10.0.4.1:8080",
  "[2026-05-03 20:17:00] INFO: healthy",
].join("\n");

function load(text: string): LogStore {
  const store = new LogStore();
  store.push(text);
  store.end();
  return store;
}

const f = (patch: Partial<Filter> = {}): Filter => ({ ...DEFAULT_FILTER, ...patch });

describe("detectLevel", () => {
  it("prefers an explicit level token over keywords", () => {
    expect(detectLevel("INFO: errors: 0, no failure", null, false)).toBe("INFO");
    expect(detectLevel("DEBUG retry failed", null, false)).toBe("DEBUG");
  });
  it("falls back to keywords and bracket levels", () => {
    expect(detectLevel("connection refused", null, false)).toBe("ERROR");
    expect(detectLevel("retry attempt 2 of 3", null, false)).toBe("WARN");
    expect(detectLevel("2026/01/01 [crit] 12#0: oops", null, false)).toBe("CRITICAL");
    expect(detectLevel("all good", null, false)).toBe("INFO");
  });
  it("uses the HTTP status of access logs", () => {
    expect(detectLevel('1.2.3.4 - - [x] "GET / HTTP/1.1" 502 120', null, false)).toBe("ERROR");
    expect(detectLevel('1.2.3.4 - - [x] "GET / HTTP/1.1" 404 120', null, false)).toBe("WARN");
    expect(detectLevel('1.2.3.4 - - [x] "GET / HTTP/1.1" 200 120', null, false)).toBe("INFO");
  });
  it("gives stack lines the level of the line before", () => {
    expect(detectLevel("    at foo (bar.js:1:1)", "CRITICAL", true)).toBe("CRITICAL");
  });
});

describe("parseTimestamp", () => {
  it("parses ISO with and without zone", () => {
    expect(parseTimestamp("[2026-05-03 20:10:15] x")).toBe(Date.UTC(2026, 4, 3, 20, 10, 15));
    expect(parseTimestamp("2026-05-03T20:10:15+02:00 x")).toBe(Date.UTC(2026, 4, 3, 18, 10, 15));
    expect(parseTimestamp("2026-05-03T20:10:15.250Z x")).toBe(Date.UTC(2026, 4, 3, 20, 10, 15, 250));
  });
  it("parses Apache and syslog formats", () => {
    expect(parseTimestamp('1.1.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /"')).toBe(Date.UTC(2023, 9, 10, 13, 55, 36));
    expect(parseTimestamp("May  3 20:10:15 host sshd[1]: hi", 2026)).toBe(Date.UTC(2026, 4, 3, 20, 10, 15));
  });
  it("returns NaN when there is none", () => {
    expect(parseTimestamp("no time here")).toBeNaN();
  });
  it("reads datetime-local input as UTC", () => {
    expect(parseTimeInput("2026-05-03T20:10")).toBe(Date.UTC(2026, 4, 3, 20, 10, 0));
    expect(parseTimeInput("")).toBeNull();
  });
});

describe("compileMatcher", () => {
  it("escapes text mode and honours case and whole word", () => {
    const { re } = compileMatcher("a.b", { regex: false, caseSensitive: false, wholeWord: false }, false);
    expect(re?.test("xA.Bx")).toBe(true);
    expect(re?.test("axb")).toBe(false);
    const word = compileMatcher("err", { regex: false, caseSensitive: false, wholeWord: true }, false).re;
    expect(word?.test("an err here")).toBe(true);
    expect(word?.test("terror")).toBe(false);
    const cs = compileMatcher("ERR", { regex: false, caseSensitive: true, wholeWord: false }, false).re;
    expect(cs?.test("err")).toBe(false);
  });
  it("splits comma terms when asked and reports bad regex", () => {
    const { re } = compileMatcher("health, ping", { regex: false, caseSensitive: false, wholeWord: false }, true);
    expect(re?.test("GET /ping")).toBe(true);
    const bad = compileMatcher("(", { regex: true, caseSensitive: false, wholeWord: false }, false);
    expect(bad.re).toBeNull();
    expect(bad.error).toBeTruthy();
  });
  it("builds a global highlight regex", () => {
    expect(buildHighlightRegex(f({ include: "auth" }))?.flags).toContain("g");
    expect(buildHighlightRegex(f())).toBeNull();
  });
});

describe("LogStore parsing", () => {
  it("handles CRLF, blank lines and chunks split mid-line", async () => {
    const store = new LogStore();
    store.push("one\r\n\r\ntw");
    store.push("o\r\nthree");
    store.end();
    expect(store.lineCount).toBe(3);
    await store.query(f());
    expect(store.getRows(0, 3).map((r) => r.text)).toEqual(["one", "two", "three"]);
  });
  it("fills in the timestamp for continuation lines", async () => {
    const store = load(SAMPLE);
    const q = await store.query(f({ from: Date.UTC(2026, 4, 3, 20, 15, 0), to: Date.UTC(2026, 4, 3, 20, 15, 30) }));
    // crash line plus its two stack lines
    expect(q?.matched).toBe(3);
  });
});

describe("LogStore query", () => {
  it("filters by level and counts the other levels", async () => {
    const store = load(SAMPLE);
    const q = await store.query(f({ levels: ["ERROR"] }));
    expect(q?.viewLength).toBe(6); // 4 auth failures + timeout + refused
    expect(q?.levelCounts.CRITICAL).toBe(3); // crash + 2 stack lines
    expect(q?.levelCounts.ERROR).toBe(6);
  });
  it("searches, excludes and reports invalid regex", async () => {
    const store = load(SAMPLE);
    expect((await store.query(f({ include: "auth failed" })))?.viewLength).toBe(4);
    expect((await store.query(f({ include: "ERROR:|WARN:", regex: true, exclude: "auth" })))?.viewLength).toBe(1);
    const bad = await store.query(f({ include: "(", regex: true }));
    expect(bad?.error).toBeTruthy();
  });
  it("adds context lines flagged as non-matches", async () => {
    const store = load(SAMPLE);
    const q = await store.query(f({ include: "healthy", context: 2 }));
    expect(q?.viewLength).toBe(3);
    expect(q?.matchRows).toBe(1);
    const rows = store.getRows(0, 3);
    expect(rows.map((r) => r.match)).toEqual([false, false, true]);
  });
  it("collapses identical consecutive rows", async () => {
    const store = load("a\na\na\nb\na");
    const q = await store.query(f({ collapse: true }));
    expect(q?.viewLength).toBe(3);
    expect(store.getRows(0, 3).map((r) => r.rep)).toEqual([3, 1, 1]);
    expect(store.exportText()).toBe("a\na\na\nb\na");
  });
  it("builds a histogram that ignores the time filter", async () => {
    const store = load(SAMPLE);
    const q = await store.query(f({ from: Date.UTC(2026, 4, 3, 20, 16, 0) }));
    expect(q?.histogram).toHaveLength(60);
    expect(q?.histogram.reduce((a, b) => a + b.count, 0)).toBe(13);
    expect(q?.matched).toBe(3);
  });
  it("cancels a superseded query", async () => {
    const store = load(SAMPLE);
    const q = await store.query(f(), () => true);
    expect(q).not.toBeNull(); // too short to reach a yield point, so it completes
  });
});

describe("LogStore navigation", () => {
  it("steps through matches with wrap-around", async () => {
    const store = load(SAMPLE);
    await store.query(f({ include: "auth failed", context: 1 }));
    const rows = store.getRows(0, 100);
    const matchRows = rows.map((r, i) => (r.match ? i : -1)).filter((i) => i >= 0);
    expect(matchRows.length).toBe(4);
    expect(store.nextMatch(-1, 1)).toBe(matchRows[0]);
    expect(store.nextMatch(matchRows[3], 1)).toBe(matchRows[0]);
    expect(store.nextMatch(matchRows[0], -1)).toBe(matchRows[3]);
    expect(store.nextMatch(matchRows[2], -1)).toBe(matchRows[1]);
  });
  it("finds the row for a file line", async () => {
    const store = load(SAMPLE);
    await store.query(f({ include: "refused" }));
    expect(store.rowOfLine(0)).toBe(0);
    expect(store.rowOfLine(500)).toBe(0);
  });
});

describe("LogStore analyze", () => {
  it("finds crash, brute force and network incidents plus IOCs", async () => {
    const store = load(SAMPLE);
    const a = await store.analyze();
    expect(a).not.toBeNull();
    const types = a!.incidents.map((i) => i.type).sort();
    expect(types).toEqual(["BRUTE_FORCE", "CRASH", "NETWORK"]);
    const brute = a!.incidents.find((i) => i.type === "BRUTE_FORCE")!;
    expect(brute.actor).toBe("10.0.5.22");
    expect(brute.total).toBe(4);
    const crash = a!.incidents.find((i) => i.type === "CRASH")!;
    expect(crash.total).toBe(3);
    const values = a!.iocs.map((i) => `${i.type}:${i.value}`);
    expect(values).toContain("IP:10.0.5.22");
    expect(values).toContain("EMAIL:admin@maker-ai.tech");
    expect(a!.iocs.find((i) => i.value === "10.0.5.22")?.count).toBe(4);
  });
  it("rejects out-of-range IP lookalikes", async () => {
    const a = await load("version 999.1.1.1 started").analyze();
    expect(a!.iocs).toHaveLength(0);
  });
});
