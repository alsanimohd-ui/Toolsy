"use client";

import { useState, useEffect, useMemo } from "react";
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
  Activity,
  Package,
  FileText,
  X,
  HelpCircle,
  Link,
  Search,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";
import {
  type CertOverview,
  type ChainStatus,
  type KeyMatch,
  buildP7b,
  buildPfx,
  certBaseName,
  certFingerprint,
  certSerial,
  certToDer,
  classifyText,
  collectPem,
  decodeUpload,
  generatePassword,
  getCertOverview,
  keyMatchesCert,
  organizeCertificates,
  unencryptedKeyPem,
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

export default function SSLToolkitClient() {
  const [originalFiles, setOriginalFiles] = useState<OriginalFile[]>([]);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isPfxModalOpen, setIsPfxModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [manualPfxPassword, setManualPfxPassword] = useState("");
  const [confirmPfxPassword, setConfirmPfxPassword] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [keyPassword, setKeyPassword] = useState("");

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 4000);
  };

  /* ── Derived state: everything is recomputed from the loaded files ── */

  const collected = useMemo(
    () => collectPem(originalFiles.filter(f => f.text).map(f => f.text as string)),
    [originalFiles]
  );
  const organized = useMemo(() => organizeCertificates(collected.certs), [collected.certs]);
  const leaf = organized.leaf;
  const chain = organized.chain;
  const chainStatus: ChainStatus = organized.chainStatus;
  const csr = collected.csr;
  const pfxFile = useMemo(() => [...originalFiles].reverse().find(f => f.bytes) ?? null, [originalFiles]);

  const privateKey = useMemo(() => {
    if (collected.keys.length === 0) return null;
    if (leaf) {
      const match = collected.keys.find(k => keyMatchesCert(k, leaf, keyPassword) === "match");
      if (match) return match;
    }
    return collected.keys[0];
  }, [collected.keys, leaf, keyPassword]);

  const keyState: KeyMatch | null = useMemo(() => {
    if (!leaf || !privateKey) return null;
    return keyMatchesCert(privateKey, leaf, keyPassword);
  }, [leaf, privateKey, keyPassword]);

  const certOverview = useMemo(() => (leaf ? getCertOverview(leaf) : null), [leaf]);
  const chainOverviews = useMemo(
    () => chain.map(c => getCertOverview(c)).filter(Boolean) as CertOverview[],
    [chain]
  );

  const sessionPfxPassword = useMemo(() => {
    if (leaf && privateKey) return generatePassword();
    return "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaf, privateKey]);

  const baseName = certBaseName(certOverview);
  const certName = `CERTIFICATE_${baseName}.crt`;
  const keyName = `PRIVATE-KEY_${baseName}.key`;
  const chainName = `CA-CHAIN_${baseName}.pem`;
  const pfxName = `PFX_${baseName}.pfx`;
  const p7bName = `P7B_${baseName}.p7b`;
  const csrName = `CSR_${baseName}.csr`;
  const derName = `CERTIFICATE_${baseName}.der.cer`;
  const fullchainName = `FULLCHAIN_${baseName}.pem`;
  const bundleName = `FULLCHAIN+KEY_${baseName}.pem`;

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

  const handleDeleteFile = (id: string) => {
    setOriginalFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setOriginalFiles([]);
    setArchiveError("");
    setKeyPassword("");
  };

  /** Replaces the PFX with its contents so they behave like any other loaded file. */
  const unlockPfx = (password: string) => {
    if (!pfxFile?.bytes) return;
    try {
      const { keys, certs } = unlockPkcs12(pfxFile.bytes, password);
      const text = [...certs, ...keys].join("\n");
      const name = `${pfxFile.name} (extracted).pem`;
      setOriginalFiles(prev => [
        ...prev.filter(f => f.id !== pfxFile.id),
        { id: newId(), name, displayType: classifyText(name, text), text },
      ]);
      setArchiveError("");
      showStatus("PFX unlocked and extracted");
    } catch {
      setArchiveError("Incorrect password or invalid file.");
    }
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

  const downloadFile = (name: string, content: BlobPart, mimeType = "text/plain") => {
    saveBlob(name, new Blob([content], { type: mimeType }));
    showStatus(`${name} ready`);
  };

  const downloadP7bSingle = () => {
    if (!leaf) return;
    const der = buildP7b(leaf, chain);
    if (der) downloadFile(p7bName, der as BlobPart, "application/x-pkcs7-certificates");
  };

  const downloadPfx = () => {
    if (!leaf || !privateKey) return;
    const bytes = buildPfx(privateKey, leaf, chain, manualPfxPassword, keyPassword);
    if (!bytes) {
      showStatus("Could not build the PFX. Check the key and certificate.");
      return;
    }
    saveBlob(pfxName, new Blob([bytes as BlobPart], { type: "application/x-pkcs12" }));
    setIsPfxModalOpen(false);
    setManualPfxPassword("");
    setConfirmPfxPassword("");
    showStatus("PFX ready");
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(sessionPfxPassword);
      showStatus("Password copied");
    } catch {
      showStatus("Could not copy. Select the password and copy it manually.");
    }
  };

  const handleDownloadAll = async () => {
    if (!hasAnyData) return;
    const zip = new JSZip();
    const dir = zip.folder(baseName)!;
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const fingerprint = leaf ? certFingerprint(leaf) ?? "N/A" : "N/A";
    const serial = leaf ? certSerial(leaf) ?? "N/A" : "N/A";

    const plainKey = privateKey ? unencryptedKeyPem(privateKey, keyPassword) : null;
    const keyIsEncrypted = !!privateKey && !plainKey && (keyState === "encrypted" || keyState === "wrong-password");
    const keyFileName = keyIsEncrypted ? keyName.replace(".key", ".encrypted.key") : keyName;
    const pfx = leaf && privateKey && keyState === "match" ? buildPfx(privateKey, leaf, chain, sessionPfxPassword, keyPassword) : null;
    const p7b = leaf ? buildP7b(leaf, chain) : null;
    const der = leaf ? certToDer(leaf) : null;
    const fullchain = leaf ? [leaf, ...chain].join("\n") + "\n" : null;
    const bundle = fullchain && plainKey && keyState === "match" ? `${fullchain}${plainKey}\n` : null;

    const descriptions: [string, string][] = [
      [certName, "Certificate (PEM). Apache SSLCertificateFile."],
      [derName, "Certificate (DER binary). Windows and some appliances."],
      [keyFileName, plainKey ? "Private key (PEM, unencrypted)." : "Private key (PEM, still encrypted)."],
      [chainName, "CA chain (PEM), leaf excluded. Apache SSLCertificateChainFile."],
      [fullchainName, "Certificate + chain in one file. Nginx ssl_certificate."],
      [bundleName, "Certificate + chain + key in one file. HAProxy and similar."],
      [pfxName, "PKCS#12 archive for IIS, Windows and Azure. Password in PFX-PASSWORD.txt."],
      [p7bName, "PKCS#7 bundle (DER) for Java and Windows imports."],
      [csrName, "Certificate signing request."],
    ];
    const present = new Set<string>();
    if (leaf) { dir.file(certName, leaf + "\n"); present.add(certName); }
    if (der) { dir.file(derName, der); present.add(derName); }
    if (privateKey) { dir.file(keyFileName, (plainKey ?? privateKey) + "\n"); present.add(keyFileName); }
    if (chain.length > 0) { dir.file(chainName, chain.join("\n\n") + "\n"); present.add(chainName); }
    if (fullchain && chain.length > 0) { dir.file(fullchainName, fullchain); present.add(fullchainName); }
    if (bundle) { dir.file(bundleName, bundle); present.add(bundleName); }
    if (pfx) {
      dir.file(pfxName, pfx);
      dir.file("PFX-PASSWORD.txt", `${sessionPfxPassword}\n`);
      present.add(pfxName);
    }
    if (p7b) { dir.file(p7bName, p7b); present.add(p7bName); }
    if (csr) { dir.file(csrName, csr + "\n"); present.add(csrName); }

    const used = new Set<string>();
    originalFiles.forEach(f => {
      let name = f.name;
      for (let n = 2; used.has(name); n++) name = `${n}-${f.name}`;
      used.add(name);
      dir.file(`originals/${name}`, f.bytes ?? f.text ?? "");
    });

    const chainLabel = {
      none: "none provided",
      complete: "complete",
      incomplete: "incomplete (an issuer is missing)",
      broken: "broken (bad signature or unrelated certificates)",
    }[chainStatus];

    const readme = [
      "SSL PACKAGE",
      `Generated by Mi (mi.maker-ai.tech) on ${timestamp} UTC`,
      "",
      "CERTIFICATE",
      `Common Name (CN):     ${certOverview?.domain || "N/A"}`,
      `Subject Alt Names:    ${certOverview?.sans.join(", ") || "None"}`,
      `Issuer:               ${certOverview?.issuer || "N/A"}`,
      `Serial Number:        ${serial}`,
      `SHA-256 Fingerprint:  ${fingerprint}`,
      `Key:                  ${certOverview ? `${certOverview.keyType} ${certOverview.keySize} bit` : "N/A"}`,
      `Signature Algorithm:  ${certOverview?.sigAlg || "N/A"}`,
      `Valid from:           ${certOverview?.validFrom || "N/A"}`,
      `Expires:              ${certOverview?.validTo || "N/A"}`,
      `Days remaining:       ${certOverview ? certOverview.daysLeft : "N/A"}`,
      "",
      "CHECKS",
      `Key matches certificate: ${keyState === "match" ? "yes" : keyState === "mismatch" ? "NO - do not deploy this pair" : "not verified"}`,
      `Chain: ${chainLabel}`,
      "",
      "FILES IN THIS FOLDER",
      ...descriptions.filter(([n]) => present.has(n)).map(([n, d]) => `${n.padEnd(42)} ${d}`),
      `${"originals/".padEnd(42)} The files you uploaded, unchanged.`,
      "",
      "DEPLOYMENT",
      `Nginx:   ssl_certificate ${fullchainName}; ssl_certificate_key ${keyFileName};`,
      `Apache:  SSLCertificateFile ${certName}, SSLCertificateKeyFile ${keyFileName}, SSLCertificateChainFile ${chainName}`,
      `HAProxy: bind :443 ssl crt ${bundleName}`,
      "IIS:     Server Certificates > Import, choose the .pfx and enter the password from PFX-PASSWORD.txt.",
      "",
      "This folder contains your private key. Keep it private.",
      "Processed locally in your browser. No data was transmitted.",
    ].join("\n");
    dir.file("README.txt", readme);

    saveBlob(`${baseName}-ssl-package.zip`, await zip.generateAsync({ type: "blob" }));
    showStatus("Package ready");
  };

  const hasAnyData = originalFiles.length > 0;

  const keyCheck = (() => {
    switch (keyState) {
      case "match": return { status: "success" as const, ok: "Match" };
      case "mismatch": return { status: "error" as const, ok: "Mismatch" };
      case "encrypted": return { status: "warning" as const, ok: "Password needed" };
      case "wrong-password": return { status: "error" as const, ok: "Wrong password" };
      case "unsupported": return { status: "pending" as const, ok: "EC / other keys are not supported yet" };
      case "invalid": return { status: "error" as const, ok: "Unreadable key" };
      default: return { status: "pending" as const, ok: "" };
    }
  })();

  const expiryCheck = !certOverview
    ? { status: "pending" as const, msg: "" }
    : certOverview.status === "expired" ? { status: "error" as const, msg: "Expired" }
    : certOverview.notYetValid ? { status: "warning" as const, msg: "Not yet valid" }
    : certOverview.status === "warning" ? { status: "warning" as const, msg: "Expires soon" }
    : { status: "success" as const, msg: "Valid" };

  const chainCheck = {
    none: { status: "pending" as const, msg: "No chain" },
    complete: { status: "success" as const, msg: "Complete" },
    incomplete: { status: "warning" as const, msg: "Issuer missing" },
    broken: { status: "error" as const, msg: "Broken" },
  }[chainStatus];

  const allCerts: { label: string; overview: CertOverview }[] = [];
  if (certOverview) allCerts.push({ label: "Leaf certificate", overview: certOverview });
  chainOverviews.forEach((c, i) => allCerts.push({ label: `CA ${chainOverviews.length - i}`, overview: c }));

  const certUnreadable = collected.certs.length > 0 && !leaf;
  const keyNeedsPassword = keyState === "encrypted" || keyState === "wrong-password";

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="SSL Toolkit"
        description="Sort, validate and repackage SSL certificate files. Drop in keys, certificates, chains and PFX archives, check that they match, and export a clean package."
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
                  <p className="text-sm font-semibold text-foreground">Drop SSL files here, or click to browse</p>
                  <p className="text-xs text-muted">.crt, .key, .pem, .pfx, .p12 and .p7b. You can also paste PEM text.</p>
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
            <SectionTitle icon={<FileText className="size-5 text-accent" />} title="Loaded files" />

            <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto custom-scrollbar">
              {originalFiles.length > 0 ? (
                originalFiles.map(file => (
                  <div key={file.id} className="group flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
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

        {/* Identity and validation */}
        {hasAnyData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <GlassCard className="lg:col-span-8 flex flex-col gap-6">
              <SectionTitle icon={<ShieldCheck className="size-5 text-accent" />} title="Certificate details" divider />

              {certOverview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-5">
                    <Field label="Common name">
                      <p className="text-sm font-bold text-foreground break-all">{certOverview.domain}</p>
                    </Field>
                    <Field label="Issuer">
                      <p className="text-sm text-muted break-all">{certOverview.issuer}</p>
                    </Field>
                    {certOverview.sans.length > 0 && (
                      <Field label="Subject alternative names">
                        <div className="flex flex-wrap gap-1.5">
                          {certOverview.sans.slice(0, 8).map((san, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-surface border border-border text-xs text-muted font-mono">{san}</span>
                          ))}
                          {certOverview.sans.length > 8 && <span className="text-xs text-muted">+{certOverview.sans.length - 8} more</span>}
                        </div>
                      </Field>
                    )}
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Valid from">
                        <p className="text-sm font-semibold text-foreground">{certOverview.validFrom}</p>
                      </Field>
                      <Field label="Expires">
                        <p className={`text-sm font-semibold ${certOverview.status === "expired" ? "text-red-400" : "text-foreground"}`}>{certOverview.validTo}</p>
                      </Field>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Time remaining</span>
                        {certOverview.status === "valid" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Clock className="size-4 text-amber-400" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${expiryColor(certOverview.daysLeft)}`}>{Math.abs(certOverview.daysLeft)}</span>
                        <span className="text-xs text-muted">{certOverview.daysLeft < 0 ? "days overdue" : "days left"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Key">
                        <p className="text-sm text-muted">{certOverview.keyType} {certOverview.keySize} bit</p>
                      </Field>
                      <Field label="Signature algorithm">
                        <p className="text-sm text-muted break-all">{certOverview.sigAlg}</p>
                      </Field>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Search className="size-8 text-muted" />}
                  title={certUnreadable ? "Certificate could not be read" : "No certificate found"}
                  hint={certUnreadable ? "Only RSA certificates are supported for now." : "Add a .crt or .pem file to see its details."}
                />
              )}
            </GlassCard>

            <GlassCard className="lg:col-span-4 flex flex-col gap-6">
              <SectionTitle icon={<Activity className="size-5 text-accent" />} title="Checks" divider />

              <div className="flex flex-col gap-3">
                <ValidationStatus label="Key matches certificate" status={keyCheck.status} message={keyCheck.ok} />
                <ValidationStatus label="Validity" status={expiryCheck.status} message={expiryCheck.msg} />
                <ValidationStatus label="CA chain" status={chainCheck.status} message={chainCheck.msg} />
              </div>

              {keyNeedsPassword && (
                <PasswordBox
                  title="Private key is encrypted"
                  placeholder="Key password"
                  onSubmit={setKeyPassword}
                  error={keyState === "wrong-password" ? "Incorrect password." : ""}
                />
              )}

              {pfxFile && (
                <PasswordBox
                  title={`Unlock ${pfxFile.name}`}
                  placeholder="PFX password"
                  onSubmit={unlockPfx}
                  error={archiveError}
                />
              )}
            </GlassCard>
          </div>
        )}

        {/* Chain and expiry */}
        {hasAnyData && (chain.length > 0 || leaf) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <GlassCard className="lg:col-span-7 flex flex-col gap-6">
              <SectionTitle icon={<Link className="size-5 text-accent" />} title="Certificate chain" divider />

              <div className="flex flex-col gap-1 pl-6 border-l-2 border-accent ml-4">
                {chainOverviews.length > 0 && (
                  <ChainNode label={chainStatus === "complete" ? "Root CA" : "Top of chain"} cert={chainOverviews[chainOverviews.length - 1]} />
                )}
                {chainOverviews.slice(0, -1).reverse().map((cert, i) => (
                  <ChainNode key={i} label={`Intermediate CA ${chainOverviews.length - 1 - i}`} cert={cert} />
                ))}
                {certOverview && <ChainNode label="Leaf certificate" cert={certOverview} />}
              </div>
            </GlassCard>

            <GlassCard className="lg:col-span-5 flex flex-col gap-6">
              <SectionTitle icon={<Clock className="size-5 text-accent" />} title="Expiry overview" divider />

              <div className="flex flex-col gap-3">
                {allCerts.map(({ label, overview }, i) => {
                  const d = overview.daysLeft;
                  const color = expiryColor(d);
                  const tone = d < 0 ? "bg-red-500/10 border-red-500/20" : d < 30 ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20";
                  return (
                    <div key={i} className={`p-4 rounded-2xl border ${tone}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted">{label}</span>
                        <span className={`text-xs font-bold ${color}`}>{d < 0 ? "Expired" : d < 30 ? "Expiring soon" : "Valid"}</span>
                      </div>
                      <p className="text-sm font-bold text-foreground break-all mb-2">{overview.domain}</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${color}`}>{Math.abs(d)}</span>
                        <span className="text-xs text-muted">{d < 0 ? "days overdue" : "days remaining"}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">Expires {overview.validTo}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        )}

        {/* Export */}
        {hasAnyData && (
          <GlassCard className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <SectionTitle icon={<Package className="size-5 text-accent" />} title="Export" />
              <button onClick={() => setIsDocModalOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-accent transition-colors">
                <HelpCircle className="size-4" />
                Help
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 flex flex-col gap-3">
                <span className="text-xs font-semibold text-muted">Individual files</span>
                <div className="flex flex-col gap-2">
                  {leaf && <DownloadItem icon={<FileCheck className="size-4 text-accent" />} type="Certificate" name={certName} onClick={() => downloadFile(certName, leaf)} />}
                  {privateKey && <DownloadItem icon={<Key className="size-4 text-accent" />} type="Private key" name={keyName} onClick={() => downloadFile(keyName, privateKey)} />}
                  {chain.length > 0 && <DownloadItem icon={<Link className="size-4 text-accent" />} type="CA chain" name={chainName} onClick={() => downloadFile(chainName, chain.join("\n\n"))} />}
                  {leaf && chain.length > 0 && <DownloadItem icon={<Link className="size-4 text-accent" />} type="Full chain (Nginx)" name={fullchainName} onClick={() => downloadFile(fullchainName, [leaf, ...chain].join("\n") + "\n")} />}
                  {leaf && privateKey && keyState === "match" && <DownloadItem icon={<Package className="size-4 text-accent" />} type="PFX (IIS / Windows)" name={pfxName} onClick={() => setIsPfxModalOpen(true)} action="Set password" />}
                  {leaf && chain.length > 0 && <DownloadItem icon={<FileText className="size-4 text-accent" />} type="P7B (Java / import)" name={p7bName} onClick={downloadP7bSingle} />}
                  {csr && <DownloadItem icon={<FileText className="size-4 text-accent" />} type="CSR" name={csrName} onClick={() => downloadFile(csrName, csr)} />}
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="p-6 rounded-2xl bg-surface border border-accent flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-foreground">Full package</h3>
                    <p className="text-sm text-muted">One folder with every format you are likely to need: PEM, DER, fullchain, key bundle, PFX, P7B, CSR, a README and your original files.</p>
                  </div>
                  {sessionPfxPassword && keyState === "match" && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted">PFX password for this package</span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono text-foreground select-all">{sessionPfxPassword}</code>
                        <button onClick={copyPassword} aria-label="Copy password" className="p-2 rounded-lg border border-border text-muted hover:text-accent hover:border-accent transition-colors">
                          <Copy className="size-4" />
                        </button>
                      </div>
                      <span className="text-xs text-muted">Also saved in the ZIP as PFX-PASSWORD.txt.</span>
                    </div>
                  )}
                  <button onClick={handleDownloadAll} className="w-full py-3 rounded-xl bg-accent text-[#04181a] font-bold text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2">
                    <Download className="size-4" />
                    Download ZIP
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>Everything runs in your browser. Your keys are never uploaded.</p>
          <button onClick={() => setIsDocModalOpen(true)} className="font-semibold hover:text-accent transition-colors">How it works</button>
        </div>
      </div>

      <AnimatePresence>
        {isPfxModalOpen && (
          <Modal title="Create PFX archive" onClose={() => { setIsPfxModalOpen(false); setManualPfxPassword(""); setConfirmPfxPassword(""); }}>
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted leading-relaxed">Choose a password to protect the private key in the PFX. You will need it when importing the file into IIS or Windows.</p>
              <div className="flex flex-col gap-3">
                <input type="password" aria-label="PFX password" placeholder="Password" value={manualPfxPassword} onChange={(e) => setManualPfxPassword(e.target.value)} className="toolsy-input h-11 px-4 text-sm" />
                <input type="password" aria-label="Confirm PFX password" placeholder="Confirm password" value={confirmPfxPassword} onChange={(e) => setConfirmPfxPassword(e.target.value)} className="toolsy-input h-11 px-4 text-sm" />
                {manualPfxPassword && confirmPfxPassword && manualPfxPassword !== confirmPfxPassword && <p className="text-xs font-semibold text-red-400">Passwords do not match</p>}
              </div>
              <button onClick={downloadPfx} disabled={!manualPfxPassword || manualPfxPassword !== confirmPfxPassword} className="w-full py-3 rounded-xl bg-accent text-[#04181a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors">Download PFX</button>
            </div>
          </Modal>
        )}

        {isDocModalOpen && (
          <Modal title="How it works" onClose={() => setIsDocModalOpen(false)}>
            <div className="flex flex-col gap-6 text-sm text-muted leading-relaxed max-h-[60svh] overflow-y-auto custom-scrollbar pr-2">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">What it does</h4>
                <p>Fixes the &quot;folder of nameless files&quot; problem. It identifies your keys, certificates and chains, renames them clearly and bundles them for deployment.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Features</h4>
                <ul className="flex flex-col gap-1.5 list-disc list-inside">
                  <li><strong>Detection:</strong> recognises CRT, KEY, PEM, PFX and P7B files, in any upload order.</li>
                  <li><strong>Key check:</strong> verifies that an RSA private key matches a certificate. Encrypted keys ask for their password.</li>
                  <li><strong>Chain check:</strong> orders the chain by issuer and verifies each signature.</li>
                  <li><strong>Packaging:</strong> exports a ZIP with consistent file names.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Limits</h4>
                <p>Only RSA keys and certificates are supported. EC and Ed25519 files are detected but not parsed.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Privacy</h4>
                <p>All processing happens in your browser using Node-Forge. Private keys are never sent to a server.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground">Export formats</h4>
                <ul className="flex flex-col gap-1.5">
                  <li><strong className="text-foreground">CRT / PEM:</strong> Nginx, Apache and Cloudflare.</li>
                  <li><strong className="text-foreground">PFX:</strong> IIS, Windows and Azure.</li>
                  <li><strong className="text-foreground">P7B:</strong> Java (Tomcat) and Windows imports.</li>
                </ul>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ToolContainer>
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

function PasswordBox({ title, placeholder, error, onSubmit }: {
  title: string;
  placeholder: string;
  error: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => onSubmit(value);
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

function ValidationStatus({ label, status, message }: { label: string; status: "success" | "error" | "warning" | "pending"; message: string }) {
  const configs = {
    success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
    pending: { icon: Activity, color: "text-muted", bg: "bg-surface" },
  };
  const config = configs[status];
  const Icon = config.icon;
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-border">
      <span className="text-xs text-muted">{label}</span>
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-right ${config.bg} ${config.color}`}>
        <Icon className="size-3.5 shrink-0" />
        <span className="text-xs font-semibold">{message || "Not checked"}</span>
      </div>
    </div>
  );
}

function DownloadItem({ icon, type, name, onClick, action = "Download" }: { icon: React.ReactNode; type: string; name: string; onClick: () => void; action?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${action} ${name}`}
      className="group w-full text-left flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-accent transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-background">{icon}</div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted">{type}</span>
          <span className="text-sm font-semibold text-foreground truncate">{name}</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-accent shrink-0">{action}</span>
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
