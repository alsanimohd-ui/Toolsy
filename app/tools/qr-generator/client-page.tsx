"use client";

import { useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Calendar,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Globe,
  ImagePlus,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  QrCode,
  Type,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { ToolButton, ToolContainer, ToolHeader, ToolInput, ToolSection } from "@/components/tools";
import {
  buildQrPayload,
  EMPTY_FIELDS,
  type QRFields,
  type QRMode,
  type WifiEncryption,
} from "@/lib/qr-payload";

const MODES: { id: QRMode; label: string; icon: React.ElementType }[] = [
  { id: "url", label: "Website", icon: Globe },
  { id: "text", label: "Text", icon: Type },
  { id: "wifi", label: "WiFi", icon: Wifi },
  { id: "vcard", label: "Contact", icon: Users },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "event", label: "Event", icon: Calendar },
  { id: "location", label: "Location", icon: MapPin },
];

const MODE_HINT: Record<QRMode, string> = {
  url: "Opens a web address when scanned.",
  text: "Shows plain text when scanned.",
  wifi: "Lets people join the network without typing the password.",
  vcard: "Adds a contact to the phone's address book.",
  email: "Opens a new email with the fields pre-filled.",
  phone: "Starts a phone call.",
  sms: "Opens a text message with the number and message pre-filled.",
  whatsapp: "Opens a WhatsApp chat. Use the full number with country code.",
  event: "Adds an event to the calendar.",
  location: "Opens the coordinates in the maps app.",
};

const QR_SIZE = 256;

const textareaClass = "toolsy-input min-h-[110px] resize-y";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="toolsy-label">{label}</span>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            value === o.id ? "bg-accent text-[#04181a]" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function QRGeneratorClient() {
  const [mode, setMode] = useState<QRMode>("url");
  const [f, setF] = useState<QRFields>({ ...EMPTY_FIELDS, value: "https://mi.maker-ai.tech" });
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [logo, setLogo] = useState("");
  const [logoSize, setLogoSize] = useState(20);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const payload = useMemo(() => buildQrPayload(mode, f), [mode, f]);
  const effectiveLevel = logo ? "H" : level;
  const logoPx = Math.round((QR_SIZE * logoSize) / 100);

  const set = <K extends keyof QRFields>(key: K, patch: Partial<QRFields[K]> | string) =>
    setF((prev) => ({
      ...prev,
      [key]: typeof patch === "string" ? patch : { ...(prev[key] as object), ...patch },
    }));

  const switchMode = (next: QRMode) => {
    // Phone-like modes and Website/Text share one text value; reset it when the meaning changes.
    const sharesValue = (m: QRMode) => m === "url" || m === "text";
    const phoneLike = (m: QRMode) => m === "phone" || m === "sms" || m === "whatsapp";
    if (!(sharesValue(mode) && sharesValue(next)) && !(phoneLike(mode) && phoneLike(next))) {
      setF((prev) => ({ ...prev, value: next === "url" && !prev.value ? "https://" : "" }));
    }
    setMode(next);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) set("value", text);
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  };

  const handleLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 512 * 1024) {
      setError("Logo must be an image under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setLogo(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (format: "png" | "svg") => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || !payload) return;
    const data = new XMLSerializer().serializeToString(svg);
    const save = (href: string, ext: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = `mi-qr-${mode}.${ext}`;
      a.click();
    };

    if (format === "svg") {
      const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
      save(url, "svg");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1024, 1024);
        save(canvas.toDataURL("image/png"), "png");
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("PNG export failed. Try the SVG download.");
    };
    img.src = url;
  };

  const ModeIcon = MODES.find((m) => m.id === mode)!.icon;

  return (
    <ToolContainer categoryId="data-analytics">
      <ToolHeader
        title="QR Generator"
        description="Create QR codes for links, WiFi, contacts, events and more. Everything is generated in your browser."
        categoryId="data-analytics"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Controls */}
        <div className="flex min-w-0 flex-col gap-6">
          <ToolSection title="Type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchMode(m.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                    }`}
                  >
                    <m.icon className="size-4 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </ToolSection>

          <ToolSection title="Content" description={MODE_HINT[mode]}>
            {(mode === "url" || mode === "text") && (
              <div className="flex flex-col gap-3">
                {mode === "url" ? (
                  <ToolInput
                    label="Web address"
                    value={f.value}
                    onChange={(e) => set("value", e.target.value)}
                    placeholder="https://example.com"
                    spellCheck={false}
                  />
                ) : (
                  <Field label="Text">
                    <textarea
                      value={f.value}
                      onChange={(e) => set("value", e.target.value)}
                      placeholder="Type or paste text"
                      className={textareaClass}
                    />
                  </Field>
                )}
                <div>
                  <ToolButton variant="ghost" size="sm" iconLeft={<ClipboardPaste className="size-3.5" />} onClick={handlePaste}>
                    Paste from clipboard
                  </ToolButton>
                </div>
              </div>
            )}

            {mode === "wifi" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ToolInput label="Network name (SSID)" value={f.wifi.ssid} onChange={(e) => set("wifi", { ssid: e.target.value })} />
                <ToolInput
                  label="Password"
                  type="text"
                  value={f.wifi.pass}
                  disabled={f.wifi.encryption === "nopass"}
                  onChange={(e) => set("wifi", { pass: e.target.value })}
                  autoComplete="off"
                />
                <Field label="Security">
                  <Segmented<WifiEncryption>
                    label="Security"
                    value={f.wifi.encryption}
                    onChange={(encryption) => set("wifi", { encryption })}
                    options={[
                      { id: "WPA", label: "WPA/WPA2" },
                      { id: "WEP", label: "WEP" },
                      { id: "nopass", label: "None" },
                    ]}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={f.wifi.hidden}
                    onChange={(e) => set("wifi", { hidden: e.target.checked })}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Hidden network
                </label>
              </div>
            )}

            {mode === "vcard" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ToolInput label="First name" value={f.vcard.firstName} onChange={(e) => set("vcard", { firstName: e.target.value })} />
                <ToolInput label="Last name" value={f.vcard.lastName} onChange={(e) => set("vcard", { lastName: e.target.value })} />
                <ToolInput label="Mobile" value={f.vcard.phone} onChange={(e) => set("vcard", { phone: e.target.value })} />
                <ToolInput label="Work phone" value={f.vcard.workPhone} onChange={(e) => set("vcard", { workPhone: e.target.value })} />
                <ToolInput label="Email" type="email" value={f.vcard.email} onChange={(e) => set("vcard", { email: e.target.value })} />
                <ToolInput label="Website" value={f.vcard.url} onChange={(e) => set("vcard", { url: e.target.value })} />
                <ToolInput label="Company" value={f.vcard.org} onChange={(e) => set("vcard", { org: e.target.value })} />
                <ToolInput label="Job title" value={f.vcard.title} onChange={(e) => set("vcard", { title: e.target.value })} />
                <ToolInput className="md:col-span-2" label="Street" value={f.vcard.street} onChange={(e) => set("vcard", { street: e.target.value })} />
                <ToolInput label="City" value={f.vcard.city} onChange={(e) => set("vcard", { city: e.target.value })} />
                <ToolInput label="State / region" value={f.vcard.state} onChange={(e) => set("vcard", { state: e.target.value })} />
                <ToolInput label="Postal code" value={f.vcard.zip} onChange={(e) => set("vcard", { zip: e.target.value })} />
                <ToolInput label="Country" value={f.vcard.country} onChange={(e) => set("vcard", { country: e.target.value })} />
              </div>
            )}

            {mode === "email" && (
              <div className="flex flex-col gap-4">
                <ToolInput label="To" type="email" value={f.email.address} onChange={(e) => set("email", { address: e.target.value })} />
                <ToolInput label="Subject" value={f.email.subject} onChange={(e) => set("email", { subject: e.target.value })} />
                <Field label="Message">
                  <textarea value={f.email.body} onChange={(e) => set("email", { body: e.target.value })} className={textareaClass} />
                </Field>
              </div>
            )}

            {(mode === "phone" || mode === "sms" || mode === "whatsapp") && (
              <div className="flex flex-col gap-4">
                <ToolInput
                  label="Phone number"
                  hint="with country code"
                  value={f.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder="+962 79 000 0000"
                  inputMode="tel"
                />
                {mode !== "phone" && (
                  <Field label="Message (optional)">
                    <textarea value={f.message} onChange={(e) => set("message", e.target.value)} className={textareaClass} />
                  </Field>
                )}
              </div>
            )}

            {mode === "event" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ToolInput className="md:col-span-2" label="Title" value={f.event.title} onChange={(e) => set("event", { title: e.target.value })} />
                <ToolInput label="Starts" type="datetime-local" value={f.event.start} onChange={(e) => set("event", { start: e.target.value })} />
                <ToolInput label="Ends" type="datetime-local" value={f.event.end} onChange={(e) => set("event", { end: e.target.value })} />
                <ToolInput className="md:col-span-2" label="Location" value={f.event.location} onChange={(e) => set("event", { location: e.target.value })} />
                <Field label="Description" className="md:col-span-2">
                  <textarea value={f.event.description} onChange={(e) => set("event", { description: e.target.value })} className={textareaClass} />
                </Field>
              </div>
            )}

            {mode === "location" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ToolInput label="Latitude" value={f.location.lat} onChange={(e) => set("location", { lat: e.target.value })} placeholder="31.9539" inputMode="decimal" />
                <ToolInput label="Longitude" value={f.location.lng} onChange={(e) => set("location", { lng: e.target.value })} placeholder="35.9106" inputMode="decimal" />
              </div>
            )}
          </ToolSection>

          <ToolSection title="Style">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Code color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <span className="font-mono text-xs uppercase text-muted">{fgColor}</span>
                </div>
              </Field>

              <div className="flex flex-col gap-2">
                <span className="toolsy-label">Background</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    disabled={transparent}
                    onChange={(e) => setBgColor(e.target.value)}
                    aria-label="Background color"
                    className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:opacity-30"
                  />
                  <span className="font-mono text-xs uppercase text-muted">{transparent ? "none" : bgColor}</span>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={transparent}
                      onChange={(e) => setTransparent(e.target.checked)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    Transparent
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="toolsy-label">Error correction</span>
                <Segmented
                  label="Error correction"
                  value={effectiveLevel}
                  onChange={(l) => !logo && setLevel(l)}
                  options={[
                    { id: "L", label: "L · 7%" },
                    { id: "M", label: "M · 15%" },
                    { id: "Q", label: "Q · 25%" },
                    { id: "H", label: "H · 30%" },
                  ]}
                />
                {logo && <p className="text-xs text-muted">Locked to H while a logo is in the center.</p>}
              </div>

              <div className="flex flex-col gap-2">
                <span className="toolsy-label">Center logo</span>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleLogo(e.target.files?.[0])} />
                {logo ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt="" className="size-10 rounded-lg border border-border bg-white object-contain p-1" />
                      <ToolButton variant="ghost" size="sm" iconLeft={<X className="size-3.5" />} onClick={() => setLogo("")}>
                        Remove
                      </ToolButton>
                    </div>
                    <label className="flex items-center gap-3 text-xs text-muted">
                      Size
                      <input
                        type="range"
                        min={10}
                        max={25}
                        value={logoSize}
                        onChange={(e) => setLogoSize(Number(e.target.value))}
                        className="flex-1 accent-[var(--accent)]"
                      />
                      {logoSize}%
                    </label>
                  </div>
                ) : (
                  <div>
                    <ToolButton variant="secondary" size="sm" iconLeft={<ImagePlus className="size-3.5" />} onClick={() => fileRef.current?.click()}>
                      Upload image
                    </ToolButton>
                  </div>
                )}
              </div>
            </div>
          </ToolSection>
        </div>

        {/* Preview */}
        <div className="min-w-0">
          <div className="flex flex-col gap-4 xl:sticky xl:top-6">
            <ToolSection>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ModeIcon className="size-4 text-accent" />
                Preview
              </div>

              <div className="flex items-center justify-center rounded-2xl border border-border bg-surface p-5">
                {payload ? (
                  <div ref={qrRef} className="w-full max-w-[280px] rounded-xl bg-white p-3 shadow-sm">
                    <QRCodeSVG
                      value={payload}
                      size={QR_SIZE}
                      level={effectiveLevel}
                      marginSize={0}
                      bgColor={transparent ? "#ffffff00" : bgColor}
                      fgColor={fgColor}
                      style={{ width: "100%", height: "auto", display: "block" }}
                      imageSettings={
                        logo ? { src: logo, width: logoPx, height: logoPx, excavate: true } : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full max-w-[280px] flex-col items-center justify-center gap-2 text-center text-muted">
                    <QrCode className="size-10 opacity-40" />
                    <p className="text-sm">Fill in the fields to see your code.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <ToolButton variant="primary" disabled={!payload} iconLeft={<Download className="size-4" />} onClick={() => handleDownload("png")}>
                  PNG
                </ToolButton>
                <ToolButton variant="secondary" disabled={!payload} iconLeft={<Download className="size-4" />} onClick={() => handleDownload("svg")}>
                  SVG
                </ToolButton>
              </div>
              <ToolButton
                variant="ghost"
                size="sm"
                disabled={!payload}
                iconLeft={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                onClick={handleCopy}
              >
                {copied ? "Copied" : "Copy encoded text"}
              </ToolButton>

              {error && (
                <p role="alert" className="text-xs font-semibold text-red-500 dark:text-red-400">
                  {error}
                </p>
              )}
            </ToolSection>

            <p className="px-1 text-xs leading-relaxed text-muted">
              Dark code on a light background scans best. Use level H when you add a logo or print on textured material.
              PNG exports at 1024 × 1024.
            </p>
          </div>
        </div>
      </div>
    </ToolContainer>
  );
}
