/**
 * QR payload builders. Pure functions: turn form fields into the string
 * that gets encoded in the QR code. An empty string means "nothing to encode yet".
 */

export type QRMode =
  | "url"
  | "text"
  | "wifi"
  | "vcard"
  | "email"
  | "phone"
  | "sms"
  | "whatsapp"
  | "event"
  | "location";

export type WifiEncryption = "WPA" | "WEP" | "nopass";

export interface QRFields {
  value: string;
  message: string;
  wifi: { ssid: string; pass: string; encryption: WifiEncryption; hidden: boolean };
  email: { address: string; subject: string; body: string };
  vcard: {
    firstName: string;
    lastName: string;
    org: string;
    title: string;
    phone: string;
    workPhone: string;
    email: string;
    url: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  event: { title: string; location: string; start: string; end: string; description: string };
  location: { lat: string; lng: string };
}

export const EMPTY_FIELDS: QRFields = {
  value: "",
  message: "",
  wifi: { ssid: "", pass: "", encryption: "WPA", hidden: false },
  email: { address: "", subject: "", body: "" },
  vcard: {
    firstName: "",
    lastName: "",
    org: "",
    title: "",
    phone: "",
    workPhone: "",
    email: "",
    url: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  },
  event: { title: "", location: "", start: "", end: "", description: "" },
  location: { lat: "", lng: "" },
};

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const textEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([;,])/g, "\\$1");
const digits = (s: string) => s.replace(/[^0-9]/g, "");
const phone = (s: string) => {
  const t = s.trim();
  return (t.startsWith("+") ? "+" : "") + digits(t);
};

export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

/** "2026-10-19T14:30" (datetime-local) -> "20261019T143000" */
export function toIcsDate(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00` : "";
}

export function buildQrPayload(mode: QRMode, f: QRFields): string {
  switch (mode) {
    case "url":
      return normalizeUrl(f.value);
    case "text":
      return f.value;
    case "wifi": {
      const { ssid, pass, encryption, hidden } = f.wifi;
      if (!ssid) return "";
      const parts = [`T:${encryption}`, `S:${wifiEscape(ssid)}`];
      if (encryption !== "nopass") parts.push(`P:${wifiEscape(pass)}`);
      if (hidden) parts.push("H:true");
      return `WIFI:${parts.join(";")};;`;
    }
    case "email": {
      const { address, subject, body } = f.email;
      if (!address.trim()) return "";
      const q = [
        subject && `subject=${encodeURIComponent(subject)}`,
        body && `body=${encodeURIComponent(body)}`,
      ].filter(Boolean);
      return `mailto:${address.trim()}${q.length ? `?${q.join("&")}` : ""}`;
    }
    case "phone": {
      const n = phone(f.value);
      return n ? `tel:${n}` : "";
    }
    case "sms": {
      const n = phone(f.value);
      return n ? `SMSTO:${n}:${f.message}` : "";
    }
    case "whatsapp": {
      const n = digits(f.value);
      if (!n) return "";
      return `https://wa.me/${n}${f.message ? `?text=${encodeURIComponent(f.message)}` : ""}`;
    }
    case "vcard": {
      const v = f.vcard;
      if (!v.firstName && !v.lastName && !v.org) return "";
      const hasAdr = v.street || v.city || v.state || v.zip || v.country;
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${textEscape(v.lastName)};${textEscape(v.firstName)};;;`,
        `FN:${textEscape(`${v.firstName} ${v.lastName}`.trim() || v.org)}`,
        v.org && `ORG:${textEscape(v.org)}`,
        v.title && `TITLE:${textEscape(v.title)}`,
        v.phone && `TEL;TYPE=CELL:${phone(v.phone)}`,
        v.workPhone && `TEL;TYPE=WORK:${phone(v.workPhone)}`,
        v.email && `EMAIL:${v.email.trim()}`,
        v.url && `URL:${normalizeUrl(v.url)}`,
        hasAdr &&
          `ADR;TYPE=WORK:;;${[v.street, v.city, v.state, v.zip, v.country].map(textEscape).join(";")}`,
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "event": {
      const e = f.event;
      if (!e.title.trim()) return "";
      const start = toIcsDate(e.start);
      const end = toIcsDate(e.end);
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        `SUMMARY:${textEscape(e.title)}`,
        e.location && `LOCATION:${textEscape(e.location)}`,
        start && `DTSTART:${start}`,
        end && `DTEND:${end}`,
        e.description && `DESCRIPTION:${textEscape(e.description)}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "location": {
      const lat = parseFloat(f.location.lat);
      const lng = parseFloat(f.location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";
      return `geo:${lat},${lng}`;
    }
  }
}
