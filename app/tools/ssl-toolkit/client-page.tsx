"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import JSZip from "jszip";
import {
  ToolContainer,
  ToolHeader,
} from "@/components/tools";
import {
  Shield,
  FileCheck,
  Lock,
  Key,
  Download,
  Upload,
  Copy,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Package,
  FileText,
  X,
  HelpCircle,
  Link,
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import {
  type CertOverview,
  type CertSet,
  type PackageFile,
  type SetPackage,
  type StrayKeyState,
  buildInventory,
  buildSetPackage,
  classifyText,
  collectPem,
  decodeUpload,
  generatePassword,
  getCertOverview,
  parseCert,
  setBaseName,
  unlockPkcs12,
} from "@/lib/ssl-toolkit";

interface OriginalFile {
  id: string;
  name: string;
  displayType: string;
  text?: string;
  bytes?: Uint8Array;
}

const newId = () => Math.random().toString(36).substring(2, 9);

const STRAY_KEY_LABEL: Record<StrayKeyState, string> = {
  "no-certificate": "No certificate matches this key",
  encrypted: "Encrypted. Enter its password above",
  "wrong-password": "None of the passwords worked",
  unsupported: "EC and other non-RSA keys are not supported yet",
  invalid: "Could not be read",
};

export default function SSLToolkitClient() {
  const [originalFiles, setOriginalFiles] = useState<OriginalFile[]>([]);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [keyPasswords, setKeyPasswords] = useState<string[]>([]);
  const [archiveErrors, setArchiveErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const pfxPasswords = useRef(new Map<string, string>());
  const packageCache = useRef(new Map<string, SetPackage>());

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 4000);
  };

  /* ── Everything below is derived from the loaded files ── */

  const collected = useMemo(
    () => collectPem(originalFiles.filter(f => f.text).map(f => f.text as string)),
    [originalFiles]
  );
  const inventory = useMemo(() => buildInventory(collected, keyPasswords), [collected, keyPasswords]);
  const pfxFiles = useMemo(() => originalFiles.filter(f => f.bytes), [originalFiles]);
  const unreadableCerts = useMemo(() => collected.certs.filter(c => !parseCert(c)).length, [collected.certs]);

  const overviews = useMemo(() => {
    const map = new Map<string, CertOverview | null>();
    inventory.sets.forEach(s => map.set(s.leaf, getCertOverview(s.leaf)));
    return map;
  }, [inventory]);

  const pfxPasswordFor = (leaf: string) => {
    let pw = pfxPasswords.current.get(leaf);
    if (!pw) {
      pw = generatePassword();
      pfxPasswords.current.set(leaf, pw);
    }
    return pw;
  };

  /** Building a package includes a PFX, so each one is built once and reused. */
  const packageFor = (set: CertSet): SetPackage => {
    const key = [set.leaf, set.key, set.keyPassword, set.csr, ...set.chain].join("|");
    let pkg = packageCache.current.get(key);
    if (!pkg) {
      pkg = buildSetPackage(set, pfxPasswordFor(set.leaf));
      packageCache.current.set(key, pkg);
    }
    return pkg;
  };

  const summary = useMemo(() => {
    let expiring = 0;
    let expired = 0;
    let noKey = 0;
    inventory.sets.forEach(s => {
      const d = overviews.get(s.leaf)?.daysLeft;
      if (d !== undefined && d < 0) expired++;
      else if (d !== undefined && d < 30) expiring++;
      if (!s.key) noKey++;
    });
    return { expiring, expired, noKey };
  }, [inventory, overviews]);

  const lockedKeys = inventory.strayKeys.filter(k => k.state === "encrypted" || k.state === "wrong-password");
  const hasAnyData = originalFiles.length > 0;
  const hasResults = inventory.sets.length > 0 || inventory.strayKeys.length > 0 || inventory.strayCas.length > 0 || inventory.strayCsrs.length > 0;

  /* ── Loading files ── */

  const handleFiles = (files: File[]) => {
    Promise.all(files.map(async (file): Promise<OriginalFile> => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const decoded = decodeUpload(file.name, bytes);
      if (decoded.kind === "pfx") {
        return { id: newId(), name: file.name, displayType: decoded.displayType, bytes: decoded.bytes };
      }
      return { id: newId(), name: file.name, displayType: decoded.displayType, text: decoded.text };
    })).then(added => setOriginalFiles(prev => [...prev, ...added]));
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const pastedText = e.clipboardData?.getData("text");
      if (pastedText && pastedText.trim()) {
        const name = `pasted-ssl-${Date.now()}.txt`;
        setOriginalFiles(prev => [...prev, { id: newId(), name, displayType: classifyText(name, pastedText), text: pastedText }]);
        showStatus("Pasted text loaded");
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDeleteFile = (id: string) => setOriginalFiles(prev => prev.filter(f => f.id !== id));

  const clearAll = () => {
    setOriginalFiles([]);
    setKeyPasswords([]);
    setArchiveErrors({});
    setExpanded({});
  };

  /** Replaces a PFX with its contents so they are sorted like any other loaded file. */
  const unlockPfx = (file: OriginalFile, password: string) => {
    if (!file.bytes) return;
    try {
      const { keys, certs } = unlockPkcs12(file.bytes, password);
      const text = [...certs, ...keys].join("\n");
      const name = `${file.name} (extracted).pem`;
      setOriginalFiles(prev => [
        ...prev.filter(f => f.id !== file.id),
        { id: newId(), name, displayType: classifyText(name, text), text },
      ]);
      setArchiveErrors(prev => ({ ...prev, [file.id]: "" }));
      showStatus(`${file.name} unlocked`);
    } catch {
      setArchiveErrors(prev => ({ ...prev, [file.id]: "Incorrect password or invalid file." }));
    }
  };

  const addKeyPassword = (pw: string) => {
    if (pw) setKeyPasswords(prev => (prev.includes(pw) ? prev : [...prev, pw]));
  };

  /* ── Exporting ── */

  const saveBlob = (name: string, blob: Blob) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadOne = (file: PackageFile) => {
    saveBlob(file.name, new Blob([file.content as BlobPart]));
    showStatus(`${file.name} ready`);
  };

  const copyPassword = async (pw: string) => {
    try {
      await navigator.clipboard.writeText(pw);
      showStatus("Password copied");
    } catch {
      showStatus("Could not copy. Select the password and copy it manually.");
    }
  };

  const addSetFolder = (root: JSZip, set: CertSet, folderName: string) => {
    const pkg = packageFor(set);
    const dir = root.folder(folderName)!;
    pkg.files.forEach(f => dir.file(f.name, f.content));
    dir.file("README.txt", pkg.readme);
  };

  const uniqueName = (name: string, used: Set<string>) => {
    let out = name;
    for (let n = 2; used.has(out); n++) out = `${name}_${n}`;
    used.add(out);
    return out;
  };

  const downloadFolder = async (set: CertSet) => {
    const zip = new JSZip();
    const name = setBaseName(set);
    addSetFolder(zip, set, name);
    saveBlob(`${name}-ssl-package.zip`, await zip.generateAsync({ type: "blob" }));
    showStatus(`${name} package ready`);
  };

  const downloadEverything = async () => {
    setBusy(true);
    await new Promise(r => setTimeout(r, 30));
    try {
      const zip = new JSZip();
      const root = zip.folder("ssl-certificates")!;
      const used = new Set<string>();
      const index: string[] = [
        "SSL CERTIFICATES",
        `Generated by Mi (mi.maker-ai.tech) on ${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC`,
        "",
        "One folder per certificate, soonest expiry first. Open the README.txt inside each folder for details.",
        "",
      ];

      inventory.sets.forEach(set => {
        const o = overviews.get(set.leaf);
        const folder = uniqueName(setBaseName(set), used);
        addSetFolder(root, set, folder);
        const days = o ? (o.daysLeft < 0 ? `EXPIRED ${Math.abs(o.daysLeft)}d ago` : `${o.daysLeft} days left`) : "unknown";
        index.push(`${folder.padEnd(36)} expires ${o?.validTo ?? "?"} (${days}) | key: ${set.key ? "yes" : "MISSING"} | chain: ${set.chainStatus}`);
      });

      const stray = [
        ...inventory.strayKeys.map((k, i) => ({ name: `private-key-${i + 1}.key`, content: k.pem, note: STRAY_KEY_LABEL[k.state] })),
        ...inventory.strayCas.map((c, i) => ({ name: `ca-certificate-${i + 1}.pem`, content: c, note: "CA certificate not used by any certificate above" })),
        ...inventory.strayCsrs.map((c, i) => ({ name: `csr-${i + 1}.csr`, content: c, note: "CSR that matches no certificate" })),
      ];
      if (stray.length > 0) {
        const dir = root.folder("_unmatched")!;
        index.push("", "_unmatched/ (could not be assigned to a certificate)");
        stray.forEach(f => {
          dir.file(f.name, f.content + "\n");
          index.push(`  ${f.name.padEnd(30)} ${f.note}`);
        });
      }

      const originals = root.folder("_originals")!;
      const usedOriginals = new Set<string>();
      originalFiles.forEach(f => originals.file(uniqueName(f.name, usedOriginals), f.bytes ?? f.text ?? ""));
      index.push("", "_originals/ holds the files you uploaded, unchanged.", "", "These folders contain private keys. Keep them private.");
      root.file("INDEX.txt", index.join("\n"));

      saveBlob("ssl-certificates.zip", await zip.generateAsync({ type: "blob" }));
      showStatus(`${inventory.sets.length} certificate${inventory.sets.length === 1 ? "" : "s"} exported`);
    } finally {
      setBusy(false);
    }
  };

  const isExpanded = (leaf: string) => expanded[leaf] ?? inventory.sets.length <= 3;

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="SSL Toolkit"
        description="Drop in every certificate, key, chain, CSR and PFX you have, in any order. It sorts them into one folder per certificate and gives you every format you are likely to need."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-6">
        {/* Upload */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <GlassCard className="xl:col-span-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<Upload className="size-5 text-accent" />} title="Upload files" />
              {hasAnyData && (
                <button onClick={clearAll} className="text-xs font-semibold text-muted hover:text-red-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }}
              className={`relative h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer focus-within:border-accent ${
                isDragging ? "border-accent bg-surface" : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="flex flex-col items-center gap-3 text-center pointer-events-none px-6">
                <Plus className={`size-6 ${isDragging ? "text-accent" : "text-muted"}`} />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Drop all your SSL files here, or click to browse</p>
                  <p className="text-xs text-muted">.crt, .cer, .key, .pem, .csr, .pfx, .p12 and .p7b. You can also paste PEM text.</p>
                </div>
              </div>
              <input
                type="file"
                multiple
                aria-label="Upload SSL files"
                onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div role="status" aria-live="polite" className="min-h-6 self-center">
              {status && (
                <span className="text-xs font-semibold text-accent bg-surface px-4 py-1.5 rounded-full border border-border">
                  {status}
                </span>
              )}
            </div>
          </GlassCard>

          <GlassCard className="xl:col-span-5 flex flex-col gap-5">
            <SectionTitle icon={<FileText className="size-5 text-accent" />} title={`Loaded files${originalFiles.length ? ` (${originalFiles.length})` : ""}`} />

            <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto custom-scrollbar">
              {originalFiles.length > 0 ? (
                originalFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileTypeIcon type={file.displayType} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">{file.name}</span>
                        <span className="text-[11px] text-muted">{file.displayType}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState icon={<Globe className="size-8 text-muted" />} title="No files loaded" hint="Files you add will be listed here." />
              )}
            </div>
          </GlassCard>
        </div>

        {/* Needs a password */}
        {(pfxFiles.length > 0 || lockedKeys.length > 0) && (
          <GlassCard className="flex flex-col gap-4">
            <SectionTitle icon={<Lock className="size-5 text-accent" />} title="Needs a password" divider />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pfxFiles.map(f => (
                <PasswordBox
                  key={f.id}
                  title={`Unlock ${f.name}`}
                  placeholder="PFX password"
                  error={archiveErrors[f.id] ?? ""}
                  onSubmit={(pw) => unlockPfx(f, pw)}
                />
              ))}
              {lockedKeys.length > 0 && (
                <PasswordBox
                  title={`${lockedKeys.length} encrypted private key${lockedKeys.length === 1 ? "" : "s"}`}
                  placeholder="Key password"
                  error={lockedKeys.some(k => k.state === "wrong-password") ? "None of the entered passwords worked for some keys. Try another." : ""}
                  onSubmit={addKeyPassword}
                />
              )}
            </div>
            {keyPasswords.length > 0 && (
              <p className="text-xs text-muted">Every password you enter is tried on all encrypted keys.</p>
            )}
          </GlassCard>
        )}

        {/* Summary */}
        {hasAnyData && hasResults && (
          <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4" hoverEffect={false}>
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-foreground">
                {inventory.sets.length} certificate{inventory.sets.length === 1 ? "" : "s"} found
              </h2>
              <div className="flex flex-wrap gap-2">
                {summary.expired > 0 && <Pill tone="error" text={`${summary.expired} expired`} />}
                {summary.expiring > 0 && <Pill tone="warning" text={`${summary.expiring} expiring within 30 days`} />}
                {summary.noKey > 0 && <Pill tone="warning" text={`${summary.noKey} without a private key`} />}
                {inventory.strayKeys.length > 0 && <Pill tone="warning" text={`${inventory.strayKeys.length} unmatched key${inventory.strayKeys.length === 1 ? "" : "s"}`} />}
                {summary.expired + summary.expiring + summary.noKey + inventory.strayKeys.length === 0 && <Pill tone="success" text="Everything matches" />}
              </div>
            </div>
            <button
              onClick={downloadEverything}
              disabled={busy}
              className="py-3 px-6 rounded-xl bg-accent text-[#04181a] font-bold text-sm hover:bg-accent-hover disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="size-4" />
              {busy ? "Building..." : "Download everything (ZIP)"}
            </button>
          </GlassCard>
        )}

        {unreadableCerts > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{unreadableCerts} certificate{unreadableCerts === 1 ? "" : "s"} could not be read. Only RSA certificates are supported for now.</span>
          </div>
        )}

        {/* Certificates */}
        {inventory.sets.map(set => (
          <SetCard
            key={set.leaf}
            set={set}
            overview={overviews.get(set.leaf) ?? null}
            chainOverviews={set.chain.map(c => getCertOverview(c)).filter(Boolean) as CertOverview[]}
            open={isExpanded(set.leaf)}
            onToggle={() => setExpanded(prev => ({ ...prev, [set.leaf]: !isExpanded(set.leaf) }))}
            pkg={isExpanded(set.leaf) ? packageFor(set) : null}
            pfxPassword={pfxPasswordFor(set.leaf)}
            onCopyPassword={copyPassword}
            onDownloadFile={downloadOne}
            onDownloadFolder={() => downloadFolder(set)}
          />
        ))}

        {/* Unmatched */}
        {(inventory.strayKeys.length > 0 || inventory.strayCas.length > 0 || inventory.strayCsrs.length > 0) && (
          <GlassCard className="flex flex-col gap-4" hoverEffect={false}>
            <SectionTitle icon={<HelpCircle className="size-5 text-accent" />} title="Not matched to a certificate" divider />
            <div className="flex flex-col gap-2">
              {inventory.strayKeys.map((k, i) => (
                <StrayRow key={`k${i}`} icon={<Key className="size-4 text-accent" />} title={`Private key ${i + 1}`} note={STRAY_KEY_LABEL[k.state]} />
              ))}
              {inventory.strayCas.map((c, i) => {
                const o = getCertOverview(c);
                return <StrayRow key={`c${i}`} icon={<FileCheck className="size-4 text-accent" />} title={o?.domain ?? `CA certificate ${i + 1}`} note="CA certificate not used by any certificate above" />;
              })}
              {inventory.strayCsrs.map((_, i) => (
                <StrayRow key={`r${i}`} icon={<FileText className="size-4 text-accent" />} title={`CSR ${i + 1}`} note="No certificate has been issued for this request yet" />
              ))}
            </div>
            <p className="text-xs text-muted">These go into the _unmatched folder of the full ZIP, so nothing is lost.</p>
          </GlassCard>
        )}

        <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>Everything runs in your browser. Your keys are never uploaded.</p>
          <button onClick={() => setIsDocModalOpen(true)} className="font-semibold hover:text-accent transition-colors">How it works</button>
        </div>
      </div>

      <AnimatePresence>
        {isDocModalOpen && (
          <Modal title="How it works" onClose={() => setIsDocModalOpen(false)}>
            <div className="flex flex-col gap-6 text-sm text-muted leading-relaxed max-h-[60svh] overflow-y-auto custom-scrollbar pr-2">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">What it does</h4>
                <p>Fixes the &quot;folder of nameless files&quot; problem. Upload everything at once, even for many domains. Each certificate is paired with its private key, CSR and CA chain, and exported in one folder with a clear name.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">What you get per certificate</h4>
                <ul className="flex flex-col gap-1.5 list-disc list-inside">
                  <li>Certificate as PEM and DER, the CA chain, and a full chain for Nginx.</li>
                  <li>The unencrypted private key, and a certificate + chain + key file for HAProxy.</li>
                  <li>A PFX for IIS and Windows with its password in PFX-PASSWORD.txt, and a P7B for Java.</li>
                  <li>The CSR if you uploaded it, and a README with the details and deployment lines.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Passwords</h4>
                <p>Locked PFX files and encrypted keys ask for a password. Anything you enter is tried on every encrypted key.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Limits</h4>
                <p>Only RSA keys and certificates are supported. EC and Ed25519 files are detected but not parsed.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Privacy</h4>
                <p>All processing happens in your browser using Node-Forge. Private keys are never sent to a server.</p>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ToolContainer>
  );
}

/* ─────────────────────────────────────────────
   CERTIFICATE CARD
  ───────────────────────────────────────────── */

function SetCard({ set, overview, chainOverviews, open, onToggle, pkg, pfxPassword, onCopyPassword, onDownloadFile, onDownloadFolder }: {
  set: CertSet;
  overview: CertOverview | null;
  chainOverviews: CertOverview[];
  open: boolean;
  onToggle: () => void;
  pkg: SetPackage | null;
  pfxPassword: string;
  onCopyPassword: (pw: string) => void;
  onDownloadFile: (f: PackageFile) => void;
  onDownloadFolder: () => void;
}) {
  const days = overview?.daysLeft;
  const expiry =
    !overview ? null
    : overview.daysLeft < 0 ? { tone: "error" as const, text: `Expired ${Math.abs(overview.daysLeft)}d ago` }
    : overview.notYetValid ? { tone: "warning" as const, text: "Not yet valid" }
    : overview.daysLeft < 30 ? { tone: "warning" as const, text: `${overview.daysLeft} days left` }
    : { tone: "success" as const, text: `${overview.daysLeft} days left` };
  const chain = {
    none: { tone: "neutral" as const, text: "No chain" },
    complete: { tone: "success" as const, text: "Chain complete" },
    incomplete: { tone: "warning" as const, text: "Issuer missing" },
    broken: { tone: "error" as const, text: "Chain broken" },
  }[set.chainStatus];

  return (
    <GlassCard className="flex flex-col gap-6" hoverEffect={false}>
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-4 text-left">
        <div className="flex flex-col gap-2 min-w-0">
          <h2 className="text-base font-bold text-foreground break-all">{overview?.domain ?? "Unreadable certificate"}</h2>
          <div className="flex flex-wrap gap-2">
            {expiry && <Pill tone={expiry.tone} text={expiry.text} />}
            <Pill tone={set.key ? "success" : "warning"} text={set.key ? "Key matches" : "No private key"} />
            <Pill tone={chain.tone} text={chain.text} />
          </div>
        </div>
        <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-6">
            <div className="flex flex-col gap-5">
              <Field label="Issuer"><p className="text-sm text-muted break-all">{overview.issuer}</p></Field>
              {overview.sans.length > 0 && (
                <Field label="Subject alternative names">
                  <div className="flex flex-wrap gap-1.5">
                    {overview.sans.slice(0, 8).map((san, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-surface border border-border text-xs text-muted font-mono">{san}</span>
                    ))}
                    {overview.sans.length > 8 && <span className="text-xs text-muted">+{overview.sans.length - 8} more</span>}
                  </div>
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 content-start">
              <Field label="Valid from"><p className="text-sm font-semibold text-foreground">{overview.validFrom}</p></Field>
              <Field label="Expires">
                <p className={`text-sm font-semibold ${days !== undefined && days < 0 ? "text-red-400" : "text-foreground"}`}>{overview.validTo}</p>
              </Field>
              <Field label="Key"><p className="text-sm text-muted">{overview.keyType} {overview.keySize} bit</p></Field>
              <Field label="Signature"><p className="text-sm text-muted break-all">{overview.sigAlg}</p></Field>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">Chain</span>
            <div className="flex flex-col gap-1 pl-6 border-l-2 border-accent ml-4">
              {chainOverviews.length > 0 && (
                <ChainNode label={set.chainStatus === "complete" ? "Root CA" : "Top of chain"} cert={chainOverviews[chainOverviews.length - 1]} />
              )}
              {chainOverviews.slice(0, -1).reverse().map((cert, i) => (
                <ChainNode key={i} label={`Intermediate CA ${chainOverviews.length - 1 - i}`} cert={cert} />
              ))}
              <ChainNode label="Leaf certificate" cert={overview} />
            </div>
          </div>

          {pkg && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-border pt-6">
              <div className="lg:col-span-7 flex flex-col gap-3">
                <span className="text-xs font-semibold text-muted">Files in this folder</span>
                <div className="flex flex-col gap-2">
                  {pkg.files.map(f => (
                    <DownloadItem key={f.name} name={f.name} description={f.description} onClick={() => onDownloadFile(f)} />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-5 flex flex-col gap-4">
                {pkg.hasPfx && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted">PFX password</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono text-foreground select-all">{pfxPassword}</code>
                      <button onClick={() => onCopyPassword(pfxPassword)} aria-label="Copy password" className="p-2 rounded-lg border border-border text-muted hover:text-accent hover:border-accent transition-colors">
                        <Copy className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
                {!set.key && (
                  <p className="text-xs text-amber-400">No private key matched this certificate, so the key, PFX and combined files are not included.</p>
                )}
                <button onClick={onDownloadFolder} className="w-full py-3 rounded-xl bg-accent text-[#04181a] font-bold text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2">
                  <Package className="size-4" />
                  Download this folder (ZIP)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

/* ─────────────────────────────────────────────
   HELPERS
  ───────────────────────────────────────────── */

function expiryColor(daysLeft: number) {
  return daysLeft < 0 ? "text-red-400" : daysLeft < 30 ? "text-amber-400" : "text-emerald-400";
}

function SectionTitle({ icon, title, divider = false }: { icon: React.ReactNode; title: string; divider?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${divider ? "border-b border-border pb-4" : ""}`}>
      {icon}
      <h2 className="text-base font-bold text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-2xl gap-2">
      {icon}
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  const cls = "size-5 shrink-0 text-accent";
  if (type.includes("Key")) return <Key className={cls} />;
  if (type.includes("Archive")) return <Package className={cls} />;
  if (type === "CA Chain" || type === "P7B Bundle") return <Link className={cls} />;
  if (type === "Unknown") return <HelpCircle className={cls} />;
  return <FileCheck className={cls} />;
}

function Pill({ tone, text }: { tone: "success" | "warning" | "error" | "neutral"; text: string }) {
  const styles = {
    success: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10" },
    warning: { icon: AlertTriangle, cls: "text-amber-400 bg-amber-500/10" },
    error: { icon: AlertCircle, cls: "text-red-400 bg-red-500/10" },
    neutral: { icon: Clock, cls: "text-muted bg-surface" },
  }[tone];
  const Icon = styles.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${styles.cls}`}>
      <Icon className="size-3.5 shrink-0" />
      {text}
    </span>
  );
}

function StrayRow({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
      <div className="p-2 rounded-lg bg-background shrink-0">{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold text-foreground truncate">{title}</span>
        <span className="text-xs text-muted">{note}</span>
      </div>
    </div>
  );
}

function PasswordBox({ title, placeholder, error, onSubmit }: {
  title: string;
  placeholder: string;
  error: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    onSubmit(value);
    setValue("");
  };
  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 min-w-0">
        <Lock className="size-4 shrink-0" />
        <span className="truncate">{title}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="toolsy-input h-9 text-sm"
        />
        <button onClick={submit} className="h-9 px-4 rounded-lg bg-amber-500 text-[#1a1000] text-xs font-bold hover:bg-amber-400 transition-colors">Unlock</button>
      </div>
      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
    </div>
  );
}

function DownloadItem({ name, description, onClick }: { name: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Download ${name}`}
      className="group w-full text-left flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-accent transition-colors"
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold text-foreground truncate">{name}</span>
        <span className="text-xs text-muted">{description}</span>
      </div>
      <Download className="size-4 text-accent shrink-0" />
    </button>
  );
}

function ChainNode({ label, cert }: { label: string; cert: CertOverview }) {
  const d = cert.daysLeft;
  const border = d < 0 ? "border-red-500/30" : d < 30 ? "border-amber-500/30" : "border-border";
  return (
    <div className="relative pb-4">
      <div className={`relative p-4 rounded-2xl bg-surface border ${border} ml-2`}>
        <span className="absolute -left-[31px] top-5 size-3 rounded-full bg-accent" />
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-xs text-muted">{label}</span>
          <span className={`text-xs font-bold ${expiryColor(d)}`}>{d < 0 ? "Expired" : `${d}d`}</span>
        </div>
        <p className="text-sm font-bold text-foreground break-all">{cert.domain}</p>
        <div className="mt-1 flex flex-col sm:flex-row sm:gap-4 text-xs text-muted">
          <span>Issuer: {cert.issuer}</span>
          <span>{cert.validFrom} → {cert.validTo}</span>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={reduce ? false : { opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface-raised shadow-2xl"
      >
        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-accent" />
              <h3 className="text-base font-bold text-foreground">{title}</h3>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-muted hover:text-foreground transition-colors"><X className="size-5" /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
