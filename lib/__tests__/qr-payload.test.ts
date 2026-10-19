import { describe, it, expect } from "vitest";
import { buildQrPayload, EMPTY_FIELDS, normalizeUrl, toIcsDate, type QRFields } from "../qr-payload";

const fields = (patch: Partial<QRFields>): QRFields => ({ ...EMPTY_FIELDS, ...patch });

describe("qr-payload", () => {
  it("returns empty for blank input", () => {
    expect(buildQrPayload("url", EMPTY_FIELDS)).toBe("");
    expect(buildQrPayload("wifi", EMPTY_FIELDS)).toBe("");
    expect(buildQrPayload("location", EMPTY_FIELDS)).toBe("");
  });

  it("adds https only when there is no scheme", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://a.io")).toBe("http://a.io");
    expect(normalizeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
  });

  it("builds WiFi payloads with escaping and no password for open networks", () => {
    const wifi = { ssid: "My;Net", pass: 'p:a"ss', encryption: "WPA" as const, hidden: true };
    expect(buildQrPayload("wifi", fields({ wifi }))).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:a\\"ss;H:true;;');
    expect(buildQrPayload("wifi", fields({ wifi: { ...wifi, encryption: "nopass", hidden: false } }))).toBe(
      "WIFI:T:nopass;S:My\\;Net;;",
    );
  });

  it("builds mailto with encoded subject and body", () => {
    const email = { address: "a@b.com", subject: "Hi there", body: "x&y" };
    expect(buildQrPayload("email", fields({ email }))).toBe("mailto:a@b.com?subject=Hi%20there&body=x%26y");
  });

  it("builds phone, sms and whatsapp payloads", () => {
    expect(buildQrPayload("phone", fields({ value: "+1 (555) 010-2030" }))).toBe("tel:+15550102030");
    expect(buildQrPayload("sms", fields({ value: "555", message: "yo" }))).toBe("SMSTO:555:yo");
    expect(buildQrPayload("whatsapp", fields({ value: "+962 79 123", message: "a b" }))).toBe(
      "https://wa.me/96279123?text=a%20b",
    );
  });

  it("builds a vCard", () => {
    const vcard = { ...EMPTY_FIELDS.vcard, firstName: "Ada", lastName: "Lovelace", email: "ada@x.io" };
    const out = buildQrPayload("vcard", fields({ vcard }));
    expect(out).toContain("BEGIN:VCARD");
    expect(out).toContain("N:Lovelace;Ada;;;");
    expect(out).toContain("EMAIL:ada@x.io");
    expect(out.endsWith("END:VCARD")).toBe(true);
  });

  it("builds an event with ICS dates", () => {
    expect(toIcsDate("2026-10-19T14:30")).toBe("20261019T143000");
    const event = { title: "Standup", location: "", start: "2026-10-19T09:00", end: "", description: "" };
    const out = buildQrPayload("event", fields({ event }));
    expect(out).toContain("SUMMARY:Standup");
    expect(out).toContain("DTSTART:20261019T090000");
    expect(out).not.toContain("DTEND");
  });

  it("validates location ranges", () => {
    expect(buildQrPayload("location", fields({ location: { lat: "31.95", lng: "35.93" } }))).toBe("geo:31.95,35.93");
    expect(buildQrPayload("location", fields({ location: { lat: "91", lng: "0" } }))).toBe("");
  });
});
