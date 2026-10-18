/**
 * Log engine: parses, indexes and filters large log files.
 *
 * Pure TypeScript with no DOM access, so it runs inside a Web Worker
 * (see log-worker.ts) and can be unit-tested directly. The page never holds
 * the whole file; it asks the store for the slice of rows it is showing.
 */

export const LEVELS = ["CRITICAL", "ERROR", "WARN", "INFO", "DEBUG"] as const;
export type Level = (typeof LEVELS)[number];

export interface Filter {
  /** Levels to show. Empty means all. */
  levels: Level[];
  include: string;
  /** Exclude terms: comma separated in text mode, one pattern in regex mode. */
  exclude: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Inclusive range in epoch ms, compared against timestamps as written in the log (UTC). */
  from: number | null;
  to: number | null;
  /** Lines of context around each match. */
  context: number;
  collapse: boolean;
}

export const DEFAULT_FILTER: Filter = {
  levels: [],
  include: "",
  exclude: "",
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  from: null,
  to: null,
  context: 0,
  collapse: false,
};

export interface Row {
  /** 0-based index in the file (non-blank lines only). */
  line: number;
  text: string;
  level: Level;
  stack: boolean;
  /** False for lines shown only as context around a match. */
  match: boolean;
  /** How many identical consecutive lines this row stands for. */
  rep: number;
}

export interface HistogramBucket {
  count: number;
  errors: number;
}

export interface QueryResult {
  total: number;
  /** Lines that satisfy every filter, before context and collapsing. */
  matched: number;
  viewLength: number;
  /** Rows that are real matches (navigable with next/prev). */
  matchRows: number;
  levelCounts: Record<Level, number>;
  histogram: HistogramBucket[];
  tMin: number | null;
  tMax: number | null;
  error: string | null;
}

export interface Incident {
  id: string;
  title: string;
  type: "CRASH" | "BRUTE_FORCE" | "NETWORK";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  total: number;
  firstLine: number;
  actor?: string;
  preview: { line: number; text: string }[];
}

export interface IocEntry {
  type: "IP" | "URL" | "EMAIL" | "HASH";
  value: string;
  count: number;
  firstLine: number;
}

export interface Analysis {
  incidents: Incident[];
  iocs: IocEntry[];
  iocTotal: number;
}

/* ───────────── line parsing ───────────── */

const LEVEL_CODE: Record<Level, number> = { CRITICAL: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };
const HISTOGRAM_BUCKETS = 60;
const MAX_ROW_CHARS = 4000;
const YIELD_EVERY = 50_000;

const STACK_RE = /^\s+at\s|^\s*\.\.\.\s*\d+\s+more|^\s*Caused by:|^\s+File ".*", line \d+|^Traceback \(most recent/;
const EXPLICIT_LEVEL_RE = /\b(CRITICAL|FATAL|PANIC|ERROR|WARNING|WARN|INFO|DEBUG|TRACE)\b/;
const BRACKET_LEVEL_RE = /\[(emerg|alert|crit|error|warn|notice|info|debug)\]/i;
const CRITICAL_RE = /\b(fatal|panic|critical)\b|OutOfMemory/i;
const ERROR_RE = /\b(fail(?:ed|ure|ures)?|crash(?:ed)?|exception|timeout|timed out|refused|denied)\b/i;
const WARN_RE = /\b(warn(?:ing)?|latency|retry|retrying)\b/i;
const HTTP_STATUS_RE = /" (\d{3}) (?:\d+|-)/;

const EXPLICIT_MAP: Record<string, Level> = {
  CRITICAL: "CRITICAL", FATAL: "CRITICAL", PANIC: "CRITICAL",
  ERROR: "ERROR", WARNING: "WARN", WARN: "WARN", INFO: "INFO", DEBUG: "DEBUG", TRACE: "DEBUG",
};
const BRACKET_MAP: Record<string, Level> = {
  emerg: "CRITICAL", alert: "CRITICAL", crit: "CRITICAL",
  error: "ERROR", warn: "WARN", notice: "INFO", info: "INFO", debug: "DEBUG",
};

export function detectLevel(text: string, previous: Level | null, stack: boolean): Level {
  if (stack) return previous ?? "ERROR";
  const explicit = EXPLICIT_LEVEL_RE.exec(text);
  if (explicit) return EXPLICIT_MAP[explicit[1]];
  const bracket = BRACKET_LEVEL_RE.exec(text);
  if (bracket) return BRACKET_MAP[bracket[1].toLowerCase()];
  if (CRITICAL_RE.test(text)) return "CRITICAL";
  const http = HTTP_STATUS_RE.exec(text);
  if (http) {
    const code = Number(http[1]);
    if (code >= 500) return "ERROR";
    if (code >= 400) return "WARN";
  }
  if (ERROR_RE.test(text)) return "ERROR";
  if (WARN_RE.test(text)) return "WARN";
  return "INFO";
}

const ISO_RE = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\s*(Z|[+-]\d{2}:?\d{2})?/;
const APACHE_RE = /(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/;
const SYSLOG_RE = /^(?:<\d+>)?([A-Z][a-z]{2})\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2})/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function offsetMs(tz: string | undefined): number {
  if (!tz || tz === "Z") return 0;
  const sign = tz[0] === "-" ? -1 : 1;
  const digits = tz.slice(1).replace(":", "");
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 60_000;
}

/** Epoch ms (UTC) of the first timestamp in the line, or NaN. Timestamps without a zone count as UTC. */
export function parseTimestamp(text: string, nowYear = new Date().getUTCFullYear()): number {
  const head = text.length > 160 ? text.slice(0, 160) : text;
  let m = ISO_RE.exec(head);
  if (m) {
    const frac = m[7] ? Number(m[7].padEnd(3, "0").slice(0, 3)) : 0;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], frac) - offsetMs(m[8]);
  }
  m = APACHE_RE.exec(head);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon >= 0) return Date.UTC(+m[3], mon, +m[1], +m[4], +m[5], +m[6]) - offsetMs(m[7]);
  }
  m = SYSLOG_RE.exec(head);
  if (m) {
    const mon = MONTHS.indexOf(m[1].toLowerCase());
    if (mon >= 0) return Date.UTC(nowYear, mon, +m[2], +m[3], +m[4], +m[5]);
  }
  return NaN;
}

export function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

/** `datetime-local` value ("YYYY-MM-DDTHH:MM[:SS]") to epoch ms, read as UTC. */
export function parseTimeInput(value: string): number | null {
  if (!value) return null;
  const v = value.length === 16 ? `${value}:00` : value;
  const ms = Date.parse(`${v}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function toTimeInput(ms: number | null): string {
  return ms === null ? "" : new Date(ms).toISOString().slice(0, 19);
}

/* ───────────── search ───────────── */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileMatcher(
  source: string,
  opts: { regex: boolean; caseSensitive: boolean; wholeWord: boolean },
  splitTerms: boolean
): { re: RegExp | null; error: string | null } {
  const trimmed = opts.regex ? source : source.trim();
  if (!trimmed) return { re: null, error: null };
  let pattern: string;
  if (opts.regex) {
    pattern = trimmed;
  } else {
    const terms = splitTerms ? trimmed.split(",").map((t) => t.trim()).filter(Boolean) : [trimmed];
    if (terms.length === 0) return { re: null, error: null };
    pattern = terms.map(escapeRegex).join("|");
  }
  if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  try {
    return { re: new RegExp(pattern, opts.caseSensitive ? "" : "i"), error: null };
  } catch (e) {
    return { re: null, error: e instanceof Error ? e.message : "Invalid pattern" };
  }
}

/** Global regex for highlighting the include pattern in the UI. */
export function buildHighlightRegex(filter: Pick<Filter, "include" | "regex" | "caseSensitive" | "wholeWord">): RegExp | null {
  const { re } = compileMatcher(filter.include, filter, false);
  return re ? new RegExp(re.source, `${re.flags}g`) : null;
}

/* ───────────── store ───────────── */

/** All matches of a global regex as an array (iterating matchAll needs a newer compile target). */
function matches(text: string, re: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(re));
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export class LogStore {
  private lines: string[] = [];
  private levels: number[] = [];
  private stacks: boolean[] = [];
  /** Forward-filled so continuation lines inherit the previous timestamp. NaN until the first one. */
  private times: number[] = [];
  private remainder = "";
  private lastTime = NaN;
  private lastLevel: Level | null = null;

  private view = new Int32Array(0);
  private viewRep = new Int32Array(0);
  private viewMatch = new Uint8Array(0);
  private matchRowIdx = new Int32Array(0);

  get lineCount(): number {
    return this.lines.length;
  }

  get timeRange(): { min: number; max: number } | null {
    let min = Infinity;
    let max = -Infinity;
    for (const t of this.times) {
      if (t < min) min = t;
      if (t > max) max = t;
    }
    return min === Infinity ? null : { min, max };
  }

  reset(): void {
    this.lines = [];
    this.levels = [];
    this.stacks = [];
    this.times = [];
    this.remainder = "";
    this.lastTime = NaN;
    this.lastLevel = null;
    this.view = new Int32Array(0);
    this.viewRep = new Int32Array(0);
    this.viewMatch = new Uint8Array(0);
    this.matchRowIdx = new Int32Array(0);
  }

  /** Feed raw text; may end mid-line. Call end() after the last chunk. */
  push(chunk: string): void {
    const text = this.remainder + chunk;
    let start = 0;
    let nl: number;
    while ((nl = text.indexOf("\n", start)) !== -1) {
      let end = nl;
      if (end > start && text.charCodeAt(end - 1) === 13) end--;
      this.addLine(text.slice(start, end));
      start = nl + 1;
    }
    this.remainder = text.slice(start);
  }

  end(): void {
    if (this.remainder) this.addLine(this.remainder.replace(/\r$/, ""));
    this.remainder = "";
  }

  private addLine(text: string): void {
    if (!text.trim()) return;
    const stack = STACK_RE.test(text);
    const level = detectLevel(text, this.lastLevel, stack);
    const ts = parseTimestamp(text);
    if (!Number.isNaN(ts)) this.lastTime = ts;
    this.lines.push(text);
    this.levels.push(LEVEL_CODE[level]);
    this.stacks.push(stack);
    this.times.push(this.lastTime);
    if (!stack) this.lastLevel = level;
  }

  /**
   * Apply a filter and rebuild the view. Yields to the event loop so a newer
   * query can cancel this one; returns null when cancelled.
   */
  async query(filter: Filter, isCancelled: () => boolean = () => false): Promise<QueryResult | null> {
    const n = this.lines.length;
    const inc = compileMatcher(filter.include, filter, false);
    const exc = compileMatcher(filter.exclude, filter, true);
    const error = inc.error ?? exc.error;
    const incRe = inc.re;
    const excRe = exc.re;

    const levelCounts: Record<Level, number> = { CRITICAL: 0, ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
    const range = this.timeRange;
    const tMin = range?.min ?? null;
    const tMax = range?.max ?? null;
    const span = range ? range.max - range.min : 0;
    const histogram: HistogramBucket[] = range
      ? Array.from({ length: HISTOGRAM_BUCKETS }, () => ({ count: 0, errors: 0 }))
      : [];

    const levelSet = filter.levels.length ? new Set(filter.levels.map((l) => LEVEL_CODE[l])) : null;
    const hasFrom = filter.from !== null;
    const hasTo = filter.to !== null;
    const matches: number[] = [];

    for (let i = 0; i < n; i++) {
      if (i % YIELD_EVERY === YIELD_EVERY - 1) {
        await tick();
        if (isCancelled()) return null;
      }
      const text = this.lines[i];
      if (incRe && !incRe.test(text)) continue;
      if (excRe && excRe.test(text)) continue;
      const t = this.times[i];
      const code = this.levels[i];
      const passLevel = !levelSet || levelSet.has(code);

      if (range && passLevel && !Number.isNaN(t)) {
        const b = span === 0 ? 0 : Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(((t - range.min) / span) * HISTOGRAM_BUCKETS));
        histogram[b].count++;
        if (code <= 1) histogram[b].errors++;
      }

      if (hasFrom || hasTo) {
        if (Number.isNaN(t)) continue;
        if (hasFrom && t < (filter.from as number)) continue;
        if (hasTo && t > (filter.to as number)) continue;
      }
      levelCounts[LEVELS[code]]++;
      if (passLevel) matches.push(i);
    }

    // Context expansion: flag 2 = match, 1 = context only.
    const ctx = Math.max(0, Math.floor(filter.context));
    let indices: number[];
    let flags: Uint8Array | null = null;
    if (ctx > 0 && (incRe || excRe)) {
      flags = new Uint8Array(n);
      for (const m of matches) {
        const lo = Math.max(0, m - ctx);
        const hi = Math.min(n - 1, m + ctx);
        for (let j = lo; j <= hi; j++) if (flags[j] === 0) flags[j] = 1;
        flags[m] = 2;
      }
      indices = [];
      for (let i = 0; i < n; i++) if (flags[i]) indices.push(i);
    } else {
      indices = matches;
    }

    // Build view with optional collapsing of identical consecutive rows.
    const view: number[] = [];
    const rep: number[] = [];
    const isMatch: number[] = [];
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const m = flags ? (flags[i] === 2 ? 1 : 0) : 1;
      if (filter.collapse && view.length > 0) {
        const last = view.length - 1;
        if (!this.stacks[i] && this.lines[view[last]] === this.lines[i] && isMatch[last] === m) {
          rep[last]++;
          continue;
        }
      }
      view.push(i);
      rep.push(1);
      isMatch.push(m);
    }

    this.view = Int32Array.from(view);
    this.viewRep = Int32Array.from(rep);
    this.viewMatch = Uint8Array.from(isMatch);
    const matchRows: number[] = [];
    for (let r = 0; r < isMatch.length; r++) if (isMatch[r]) matchRows.push(r);
    this.matchRowIdx = Int32Array.from(matchRows);

    return {
      total: n,
      matched: matches.length,
      viewLength: view.length,
      matchRows: matchRows.length,
      levelCounts,
      histogram,
      tMin,
      tMax,
      error,
    };
  }

  getRows(start: number, end: number): Row[] {
    const rows: Row[] = [];
    const stop = Math.min(end, this.view.length);
    for (let r = Math.max(0, start); r < stop; r++) {
      const i = this.view[r];
      let text = this.lines[i];
      if (text.length > MAX_ROW_CHARS) text = `${text.slice(0, MAX_ROW_CHARS)} … (+${text.length - MAX_ROW_CHARS} chars)`;
      rows.push({
        line: i,
        text,
        level: LEVELS[this.levels[i]],
        stack: this.stacks[i],
        match: this.viewMatch[r] === 1,
        rep: this.viewRep[r],
      });
    }
    return rows;
  }

  /** Next (dir 1) or previous (dir -1) match row relative to `from`, wrapping around. -1 if none. */
  nextMatch(from: number, dir: 1 | -1): number {
    const m = this.matchRowIdx;
    if (m.length === 0) return -1;
    // First index with m[idx] > from
    let lo = 0;
    let hi = m.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (m[mid] > from) hi = mid;
      else lo = mid + 1;
    }
    if (dir === 1) return m[lo < m.length ? lo : 0];
    // Last index with m[idx] < from
    let lo2 = 0;
    let hi2 = m.length;
    while (lo2 < hi2) {
      const mid = (lo2 + hi2) >> 1;
      if (m[mid] < from) lo2 = mid + 1;
      else hi2 = mid;
    }
    return m[lo2 > 0 ? lo2 - 1 : m.length - 1];
  }

  /** Row of the first view entry at or after the given file line, or -1 when the view is empty. */
  rowOfLine(line: number): number {
    const v = this.view;
    if (v.length === 0) return -1;
    let lo = 0;
    let hi = v.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (v[mid] < line) lo = mid + 1;
      else hi = mid;
    }
    return lo < v.length ? lo : v.length - 1;
  }

  /** Current view as plain text; collapsed rows are repeated so nothing is lost. */
  exportText(): string {
    const out: string[] = [];
    for (let r = 0; r < this.view.length; r++) {
      const text = this.lines[this.view[r]];
      for (let k = 0; k < this.viewRep[r]; k++) out.push(text);
    }
    return out.join("\n");
  }

  /** Incident detection and IOC extraction over the whole file. Returns null when cancelled. */
  async analyze(isCancelled: () => boolean = () => false): Promise<Analysis | null> {
    const MAX_PREVIEW = 200;
    const MAX_IOCS = 20_000;
    const iocMap = new Map<string, IocEntry>();
    const addIoc = (type: IocEntry["type"], value: string, line: number) => {
      const key = `${type}:${value}`;
      const hit = iocMap.get(key);
      if (hit) hit.count++;
      else if (iocMap.size < MAX_IOCS) iocMap.set(key, { type, value, count: 1, firstLine: line });
    };

    const crashes: Incident[] = [];
    let crash: Incident | null = null;
    const authByIp = new Map<string, { total: number; first: number; preview: { line: number; text: string }[] }>();
    const network = { total: 0, first: -1, preview: [] as { line: number; text: string }[] };

    const n = this.lines.length;
    for (let i = 0; i < n; i++) {
      if (i % (YIELD_EVERY / 2) === YIELD_EVERY / 2 - 1) {
        await tick();
        if (isCancelled()) return null;
      }
      const text = this.lines[i];
      const lower = text.toLowerCase();
      const code = this.levels[i];
      const entry = { line: i, text: text.length > 300 ? `${text.slice(0, 300)}…` : text };

      // IOCs
      let firstIp: string | null = null;
      if (text.includes(".")) {
        for (const m of matches(text, /\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
          if (m[0].split(".").every((o) => Number(o) <= 255)) {
            firstIp ??= m[0];
            addIoc("IP", m[0], i);
          }
        }
        if (lower.includes("http")) for (const m of matches(text, /https?:\/\/[^\s"'<>)]+/g)) addIoc("URL", m[0], i);
      }
      if (text.includes("@")) for (const m of matches(text, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) addIoc("EMAIL", m[0], i);
      for (const m of matches(text, /\b(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/g)) addIoc("HASH", m[0].toLowerCase(), i);

      // Crash: consecutive critical / stack / "crash" lines form one incident
      if (code === 0 || this.stacks[i] || lower.includes("crash")) {
        if (!crash) {
          crash = { id: `crash-${i}`, title: "Application crash / panic", type: "CRASH", severity: "CRITICAL", total: 0, firstLine: i, preview: [] };
          crashes.push(crash);
        }
        crash.total++;
        if (crash.preview.length < MAX_PREVIEW) crash.preview.push(entry);
      } else {
        crash = null;
      }

      // Repeated authentication failures per source IP
      if (firstIp && (lower.includes("auth failed") || lower.includes("login failed") || lower.includes("denied"))) {
        let a = authByIp.get(firstIp);
        if (!a) authByIp.set(firstIp, (a = { total: 0, first: i, preview: [] }));
        a.total++;
        if (a.preview.length < MAX_PREVIEW) a.preview.push(entry);
      }

      // Connection problems
      if (lower.includes("timeout") || lower.includes("refused") || lower.includes("disconnected")) {
        if (network.first < 0) network.first = i;
        network.total++;
        if (network.preview.length < MAX_PREVIEW) network.preview.push(entry);
      }
    }

    const incidents: Incident[] = [...crashes.slice(0, 50)];
    for (const [ip, a] of Array.from(authByIp.entries())) {
      if (a.total >= 3) {
        incidents.push({
          id: `brute-${ip}`,
          title: `Repeated auth failures from ${ip}`,
          type: "BRUTE_FORCE",
          severity: "HIGH",
          total: a.total,
          firstLine: a.first,
          actor: ip,
          preview: a.preview,
        });
      }
    }
    if (network.total >= 2) {
      incidents.push({
        id: "network",
        title: "Timeouts and connection drops",
        type: "NETWORK",
        severity: "MEDIUM",
        total: network.total,
        firstLine: network.first,
        preview: network.preview,
      });
    }

    const all = Array.from(iocMap.values()).sort((a, b) => a.type.localeCompare(b.type) || b.count - a.count);
    return { incidents, iocs: all.slice(0, 5000), iocTotal: all.length };
  }
}
