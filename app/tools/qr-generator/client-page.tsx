"use client";

import { useState, useMemo, useRef } from "react";
import {
  ToolContainer,
  ToolHeader,
  ToolButton,
} from "@/components/tools";
import { 
  QrCode, 
  Globe, 
  Type, 
  Wifi, 
  Mail, 
  Smartphone, 
  Users, 
  MapPin, 
  Calendar, 
  Share2, 
  Download, 
  Copy, 
  Layout, 
  Palette, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle, 
  Maximize2, 
  AtSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import { QRCodeSVG } from "qrcode.react";

/* ─────────────────────────────────────────────
   Types & Constants
  ───────────────────────────────────────────── */

type QRMode = 
  | "url" | "text" | "wifi" | "email" | "phone" 
  | "sms" | "whatsapp" | "vcard" | "event" 
  | "location" | "social" | "json" | "appstore";

interface QRState {
  mode: QRMode;
  value: string;
  // Specific fields for complex modes
  wifi: { ssid: string; pass: string; encryption: "WPA" | "WEP" | "nopass" };
  email: { address: string; subject: string; body: string };
  vcard: { 
    firstName: string; 
    lastName: string; 
    org: string; 
    title: string;
    phone: string; 
    workPhone: string;
    fax: string;
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
  social: { platform: string; username: string };
  // Styling
  fgColor: string;
  bgColor: string;
  level: "L" | "M" | "Q" | "H";
  includeLogo: boolean;
  logoUrl: string;
  logoSize: number;
}

const INITIAL_STATE: QRState = {
  mode: "url",
  value: "https://mi.maker-ai.tech",
  wifi: { ssid: "", pass: "", encryption: "WPA" },
  email: { address: "", subject: "", body: "" },
  vcard: { 
    firstName: "", 
    lastName: "", 
    org: "", 
    title: "",
    phone: "", 
    workPhone: "",
    fax: "",
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
  social: { platform: "twitter", username: "" },
  fgColor: "#000000",
  bgColor: "#ffffff",
  level: "M",
  includeLogo: false,
  logoUrl: "",
  logoSize: 20,
};

/* ─────────────────────────────────────────────
   QR Generator Component
  ───────────────────────────────────────────── */

export default function QRGeneratorClient() {
  const [state, setState] = useState<QRState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<"content" | "style">("content");
  const [copied, setCopied] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Generate the final string based on mode - Robust formatting
  const qrValue = useMemo(() => {
    // If we have no base value for simple modes, return a fallback to prevent blank QR
    const baseValue = state.value || "https://mi.maker-ai.tech";

    switch (state.mode) {
      case "url": {
        let val = baseValue.trim();
        if (!val.startsWith("http") && !val.startsWith("mailto:")) {
          val = `https://${val}`;
        }
        return val;
      }
      case "text": return baseValue;
      case "wifi": {
        const { ssid, pass, encryption } = state.wifi;
        if (!ssid) return "WIFI:S:Mi;P:;T:nopass;;";
        return `WIFI:T:${encryption};S:${ssid};P:${pass};;`;
      }
      case "email": {
        const { address, subject, body } = state.email;
        if (!address) return "mailto:hello@maker-ai.tech";
        return `MATMSG:TO:${address};SUB:${subject};BODY:${body};;`;
      }
      case "phone": return `tel:${baseValue.replace(/[^0-9+]/g, "")}`;
      case "sms": return `smsto:${baseValue.replace(/[^0-9+]/g, "")}`;
      case "whatsapp": return `https://wa.me/${baseValue.replace(/[^0-9]/g, "")}`;
      case "vcard": {
        const { firstName, lastName, org, title, phone, workPhone, fax, email, url, street, city, state: vState, zip, country } = state.vcard;
        if (!firstName && !lastName && !org) return "BEGIN:VCARD\nVERSION:3.0\nN:User;Mi\nFN:Mi User\nEND:VCARD";
        
        return [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${lastName || ""};${firstName || ""};;;`,
          `FN:${firstName || ""} ${lastName || ""}`.trim(),
          org ? `ORG:${org}` : "",
          title ? `TITLE:${title}` : "",
          phone ? `TEL;TYPE=CELL,VOICE:${phone}` : "",
          workPhone ? `TEL;TYPE=WORK,VOICE:${workPhone}` : "",
          fax ? `TEL;TYPE=FAX,VOICE:${fax}` : "",
          email ? `EMAIL;TYPE=PREF,INTERNET:${email}` : "",
          url ? `URL:${url}` : "",
          (street || city || vState || zip || country) 
            ? `ADR;TYPE=WORK,POSTAL:;;${street || ""};${city || ""};${vState || ""};${zip || ""};${country || ""}` 
            : "",
          "END:VCARD"
        ].filter(Boolean).join("\n");
      }
      case "event": {
        const { title, location, start, end, description } = state.event;
        if (!title) return "BEGIN:VEVENT\nSUMMARY:Mi Event\nEND:VEVENT";
        return [
          "BEGIN:VEVENT",
          `SUMMARY:${title}`,
          location ? `LOCATION:${location}` : "",
          start ? `DTSTART:${start.replace(/[-:]/g, "")}` : "",
          end ? `DTEND:${end.replace(/[-:]/g, "")}` : "",
          description ? `DESCRIPTION:${description}` : "",
          "END:VEVENT"
        ].filter(Boolean).join("\n");
      }
      case "location": {
        const { lat, lng } = state.location;
        if (!lat || !lng) return "geo:0,0";
        return `geo:${lat},${lng}`;
      }
      case "social": {
        const { platform, username } = state.social;
        const handle = (username || "").replace("@", "");
        if (!handle) return "https://mi.maker-ai.tech";
        if (platform === "twitter") return `https://twitter.com/${handle}`;
        if (platform === "instagram") return `https://instagram.com/${handle}`;
        if (platform === "linkedin") return `https://linkedin.com/in/${handle}`;
        return handle;
      }
      case "appstore": return `https://apps.apple.com/app/id${baseValue.replace(/[^0-9]/g, "")}`;
      case "json": {
        try {
          if (!baseValue) return "{}";
          // Try to validate JSON
          JSON.parse(baseValue);
          return baseValue;
        } catch {
          return baseValue; // Return raw even if invalid for QR, but we could handle better
        }
      }
      default: return baseValue;
    }
  }, [state]);

  const handleDownload = (format: "png" | "svg") => {
    // Find the SVG inside our container ref
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) {
      console.error("QR SVG element not found");
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    
    if (format === "svg") {
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mi-qr-${state.mode}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      img.onload = () => {
        canvas.width = 1024;
        canvas.height = 1024;
        if (ctx) {
          // Clear and fill background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (state.bgColor !== "transparent") {
            ctx.fillStyle = state.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, 1024, 1024);
          
          try {
            const pngUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = `mi-qr-${state.mode}.png`;
            link.click();
          } catch (err) {
            console.error("Canvas toDataURL failed:", err);
          }
        }
      };

      // Create blob for image source instead of b64 to prevent overflow/corruption
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
      
      // Cleanup URL after some time
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const handleCopy = () => {
    if (!qrValue) return;
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setState(prev => ({ ...prev, value: text }));
    } catch { console.error("Clipboard access denied"); }
  };

  const modes: { id: QRMode; label: string; icon: React.ElementType }[] = [
    { id: "url", label: "Website", icon: Globe },
    { id: "text", label: "Text", icon: Type },
    { id: "wifi", label: "WiFi", icon: Wifi },
    { id: "vcard", label: "vCard", icon: Users },
    { id: "email", label: "Email", icon: Mail },
    { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
    { id: "event", label: "Event", icon: Calendar },
    { id: "location", label: "Location", icon: MapPin },
  ];

  return (
    <ToolContainer categoryId="data-analytics">
      <ToolHeader
        title="QR Generator"
        description="Premium QR creation studio. Generate high-fidelity codes for URLs, networks, and business profiles with cinematic styling."
        categoryId="data-analytics"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Side: Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <GlassCard className="p-1 overflow-hidden">
            <div className="flex bg-black/40 rounded-[22px] p-1">
              <button 
                onClick={() => setActiveTab("content")}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
                  ${activeTab === "content" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-foreground"}`}
              >
                <Layout className="size-4" /> Content Source
              </button>
              <button 
                onClick={() => setActiveTab("style")}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
                  ${activeTab === "style" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-foreground"}`}
              >
                <Palette className="size-4" /> Visual Studio
              </button>
            </div>
          </GlassCard>

          <AnimatePresence mode="wait">
            {activeTab === "content" ? (
              <motion.div
                key="content-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                {/* Mode Selector - 4x2 Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setState(prev => ({ ...prev, mode: m.id }))}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-500
                        ${state.mode === m.id 
                          ? "bg-accent/10 border-accent text-accent shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]" 
                          : "bg-black/20 border-white/5 text-muted hover:border-white/10 hover:bg-black/30"}`}
                    >
                      <m.icon className={`size-5 ${state.mode === m.id ? "animate-pulse" : ""}`} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dynamic Form */}
                <GlassCard className="p-6 flex flex-col gap-6 bg-white/[0.01]">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                    <div className="size-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                      {modes.find(m => m.id === state.mode)?.icon && 
                        (() => {
                          const Icon = modes.find(m => m.id === state.mode)!.icon;
                          return <Icon className="size-5 text-accent" />;
                        })()
                      }
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                        {modes.find(m => m.id === state.mode)?.label} Configuration
                      </h3>
                      <p className="text-[10px] font-bold text-muted/60 uppercase tracking-widest">Enter the data payload for this QR module</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    {/* Clipboard Quick Action */}
                    {(state.mode === "url" || state.mode === "text" || state.mode === "json" || state.mode === "appstore") && (
                      <div className="flex justify-end">
                        <button 
                          onClick={handlePaste}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-accent hover:border-accent/20 transition-all"
                        >
                          <Copy className="size-3" /> Paste from Clipboard
                        </button>
                      </div>
                    )}

                    {state.mode === "url" && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Destination URL</label>
                        <input 
                          type="text"
                          value={state.value}
                          onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="https://example.com"
                          className="toolsy-input py-4 text-sm"
                        />
                      </div>
                    )}

                    {state.mode === "appstore" && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">App ID (e.g., 123456789)</label>
                        <input 
                          type="text"
                          value={state.value}
                          onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="123456789"
                          className="toolsy-input py-4 text-sm"
                        />
                      </div>
                    )}

                    {state.mode === "social" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Platform</label>
                          <select 
                            value={state.social.platform}
                            onChange={(e) => setState(prev => ({ ...prev, social: { ...prev.social, platform: e.target.value } }))}
                            className="toolsy-input py-4 text-sm appearance-none"
                          >
                            <option value="twitter">X / Twitter</option>
                            <option value="instagram">Instagram</option>
                            <option value="linkedin">LinkedIn</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Username / Handle</label>
                          <input 
                            type="text"
                            value={state.social.username}
                            onChange={(e) => setState(prev => ({ ...prev, social: { ...prev.social, username: e.target.value } }))}
                            placeholder="@handle"
                            className="toolsy-input py-4 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {state.mode === "text" && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Message Content</label>
                        <textarea 
                          value={state.value}
                          onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="Type your secure message here..."
                          className="toolsy-input min-h-[150px] py-4 text-sm resize-none"
                        />
                      </div>
                    )}

                    {state.mode === "wifi" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Network Name (SSID)</label>
                          <input 
                            type="text"
                            value={state.wifi.ssid}
                            onChange={(e) => setState(prev => ({ ...prev, wifi: { ...prev.wifi, ssid: e.target.value } }))}
                            className="toolsy-input py-4 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Password</label>
                          <input 
                            type="password"
                            value={state.wifi.pass}
                            onChange={(e) => setState(prev => ({ ...prev, wifi: { ...prev.wifi, pass: e.target.value } }))}
                            className="toolsy-input py-4 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {state.mode === "email" && (
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Recipient Address</label>
                          <input 
                            type="email"
                            value={state.email.address}
                            onChange={(e) => setState(prev => ({ ...prev, email: { ...prev.email, address: e.target.value } }))}
                            className="toolsy-input py-4 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Subject</label>
                          <input 
                            type="text"
                            value={state.email.subject}
                            onChange={(e) => setState(prev => ({ ...prev, email: { ...prev.email, subject: e.target.value } }))}
                            className="toolsy-input py-4 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {(state.mode === "phone" || state.mode === "sms" || state.mode === "whatsapp") && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Phone Number (with Country Code)</label>
                        <input 
                          type="text"
                          value={state.value}
                          onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="+1234567890"
                          className="toolsy-input py-4 text-sm"
                        />
                      </div>
                    )}

                    {state.mode === "vcard" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-3 col-span-1 md:col-span-2">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
                          <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="First Name" value={state.vcard.firstName} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, firstName: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                            <input type="text" placeholder="Last Name" value={state.vcard.lastName} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, lastName: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Phone Number</label>
                          <input type="text" value={state.vcard.phone} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, phone: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
                          <input type="email" value={state.vcard.email} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, email: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Company Name</label>
                          <input type="text" value={state.vcard.org} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, org: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Work Title</label>
                          <input type="text" value={state.vcard.title} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, title: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Work Phone</label>
                          <input type="text" value={state.vcard.workPhone} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, workPhone: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Fax</label>
                          <input type="text" value={state.vcard.fax} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, fax: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3 col-span-1 md:col-span-2">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Street</label>
                          <input type="text" value={state.vcard.street} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, street: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">City</label>
                          <input type="text" value={state.vcard.city} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, city: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">State</label>
                          <input type="text" value={state.vcard.state} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, state: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Country</label>
                          <input type="text" value={state.vcard.country} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, country: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Zip</label>
                          <input type="text" value={state.vcard.zip} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, zip: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>

                        <div className="flex flex-col gap-3 col-span-1 md:col-span-2">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Website</label>
                          <input type="text" value={state.vcard.url} onChange={(e) => setState(prev => ({ ...prev, vcard: { ...prev.vcard, url: e.target.value } }))} className="toolsy-input py-3 text-sm" />
                        </div>
                      </div>
                    )}

                    {state.mode === "json" && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">JSON Payload</label>
                        <textarea 
                          value={state.value}
                          onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                          placeholder='{ "id": 123, "status": "verified" }'
                          className="toolsy-input min-h-[200px] py-4 font-mono text-[11px] resize-none"
                        />
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div
                key="style-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <GlassCard className="p-6 flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Foreground Color */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Module Color</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="color" 
                          value={state.fgColor} 
                          onChange={(e) => setState(prev => ({ ...prev, fgColor: e.target.value }))}
                          className="size-14 rounded-2xl bg-black/40 border border-white/10 cursor-pointer overflow-hidden p-0"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black text-foreground uppercase">{state.fgColor}</span>
                          <span className="text-[9px] font-bold text-muted uppercase tracking-widest">HEX Code</span>
                        </div>
                      </div>
                    </div>

                    {/* Background Color */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Background Layer</label>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <input 
                            type="color" 
                            value={state.bgColor === "transparent" ? "#ffffff" : state.bgColor} 
                            onChange={(e) => setState(prev => ({ ...prev, bgColor: e.target.value }))}
                            className={`size-14 rounded-2xl bg-black/40 border border-white/10 cursor-pointer overflow-hidden p-0 transition-opacity ${state.bgColor === "transparent" ? "opacity-20" : "opacity-100"}`}
                          />
                          {state.bgColor === "transparent" && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><AtSign className="size-4 text-muted/40" /></div>}
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setState(prev => ({ ...prev, bgColor: "transparent" }))}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all
                              ${state.bgColor === "transparent" ? "bg-accent border-accent text-white" : "border-white/5 text-muted hover:border-white/10"}`}
                          >
                            Transparent
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Error Correction */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Correction Level</label>
                      <div className="grid grid-cols-4 gap-2 bg-black/20 p-1 rounded-2xl border border-white/5">
                        {(["L", "M", "Q", "H"] as const).map((l) => (
                          <button
                            key={l}
                            onClick={() => setState(prev => ({ ...prev, level: l }))}
                            className={`py-2.5 rounded-xl text-[10px] font-black transition-all
                              ${state.level === l ? "bg-white/10 text-white shadow-xl" : "text-muted hover:text-foreground"}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Branding */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Brand Identity</label>
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => setState(prev => ({ ...prev, includeLogo: !prev.includeLogo }))}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all
                            ${state.includeLogo ? "bg-accent/5 border-accent/30 text-accent" : "bg-white/[0.02] border-white/5 text-muted"}`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">Embed Logo Center</span>
                          {state.includeLogo ? <CheckCircle2 className="size-4" /> : <div className="size-4 rounded-full border border-white/10" />}
                        </button>
                        {state.includeLogo && (
                          <input 
                            type="text"
                            placeholder="Logo Image URL (SVG/PNG)"
                            value={state.logoUrl}
                            onChange={(e) => setState(prev => ({ ...prev, logoUrl: e.target.value }))}
                            className="toolsy-input py-3 text-[10px]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Studio Preview */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="sticky top-12 flex flex-col gap-8">
            
            <GlassCard className="relative group overflow-hidden bg-white/[0.01]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--accent-rgb),0.05),transparent_70%)] pointer-events-none" />
              
              <div className="p-12 flex flex-col items-center gap-12">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                  <QrCode className="size-4" /> Studio Preview
                </div>

                <div className="relative group">
                  <div className="absolute -inset-10 bg-accent/20 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div 
                    ref={qrContainerRef}
                    className="relative p-6 bg-white/[0.03] rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-3xl overflow-hidden"
                  >
                    <QRCodeSVG 
                      value={qrValue}
                      size={280}
                      level={state.level}
                      bgColor={state.bgColor === "transparent" ? "#ffffff00" : state.bgColor}
                      fgColor={state.fgColor}
                      includeMargin={false}
                      imageSettings={state.includeLogo && state.logoUrl ? {
                        src: state.logoUrl,
                        x: undefined,
                        y: undefined,
                        height: 50,
                        width: 50,
                        excavate: true,
                      } : undefined}
                    />
                  </div>
                  
                  {/* No overlay, just the QR */}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-black text-foreground uppercase tracking-wider">
                    {state.mode.toUpperCase()} Module
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted/40 uppercase tracking-widest">
                    <Maximize2 className="size-3" /> 1024 x 1024 Master Resolution
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="grid grid-cols-2 border-t border-white/5 bg-black/40">
                <button 
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-3 py-6 text-[10px] font-black uppercase tracking-widest text-muted hover:text-foreground hover:bg-white/[0.02] transition-all border-r border-white/5"
                >
                  {copied ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  {copied ? "Copied Raw" : "Copy Payload"}
                </button>
                <button 
                  onClick={() => handleDownload("svg")}
                  className="flex items-center justify-center gap-3 py-6 text-[10px] font-black uppercase tracking-widest text-muted hover:text-foreground hover:bg-white/[0.02] transition-all"
                >
                  <Share2 className="size-4" /> Share Studio
                </button>
              </div>
            </GlassCard>

            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted/60 ml-2">Production Exports</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ToolButton variant="secondary" onClick={() => handleDownload("png")} className="justify-center">
                  <Download className="size-4 mr-2" /> Download PNG
                </ToolButton>
                <ToolButton variant="primary" onClick={() => handleDownload("svg")} className="justify-center">
                  <ImageIcon className="size-4 mr-2" /> Vector SVG
                </ToolButton>
              </div>
            </div>

            {/* Quick Tips */}
            <GlassCard className="p-6 bg-accent/5 border-accent/10">
              <div className="flex gap-4">
                <AlertCircle className="size-5 text-accent shrink-0" />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Pro Tip</span>
                  <p className="text-[10px] text-muted/60 leading-relaxed font-medium">
                    Use <span className="text-accent">Level H (High)</span> correction if you plan to embed a logo or if the QR will be printed on physical textures.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

      </div>

      {/* Strategic Footer Documentation */}
      <section className="mt-16 pt-8 border-t border-white/5 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Operational Protocol</h3>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Mastering the QR Studio Ecosystem</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <GlassCard className="p-6 flex flex-col gap-5 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Globe className="size-4 text-blue-400" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider">Dynamic Routing</h4>
            </div>
            <p className="text-[11px] font-medium text-muted/60 leading-relaxed">
              Generate intelligent links for <span className="text-foreground">App Store</span>, <span className="text-foreground">Maps</span>, and <span className="text-foreground">Social Profiles</span>. The engine ensures deep-link compatibility across iOS and Android ecosystems for seamless user redirection.
            </p>
          </GlassCard>

          <GlassCard className="p-6 flex flex-col gap-5 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Palette className="size-4 text-purple-400" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider">Branding & Identity</h4>
            </div>
            <p className="text-[11px] font-medium text-muted/60 leading-relaxed">
              Embed custom brand logos using <span className="text-foreground">Excavation Modules</span>. The studio automatically removes underlying QR modules to prevent logo-clash while maintaining scan integrity through advanced Reed-Solomon error correction.
            </p>
          </GlassCard>

          <GlassCard className="p-6 flex flex-col gap-5 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Smartphone className="size-4 text-emerald-400" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider">Contactless vCards</h4>
            </div>
            <p className="text-[11px] font-medium text-muted/60 leading-relaxed">
              Bridge the physical and digital world with <span className="text-foreground">vCard 3.0</span> standards. Instantly transmit contact information, social links, and organization details directly to a user&apos;s native address book.
            </p>
          </GlassCard>
        </div>
      </section>

    </ToolContainer>
  );
}
