"use client";

import { useState, useEffect, useMemo } from "react";
import forge from "node-forge";
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

interface DetectedItems {
  key: string | null;
  cert: string | null;
  chain: string[];
  csr: string | null;
  pfx: { binary: string; passwordValue: string; error: string; filename: string } | null;
}

interface CertOverview {
  domain: string;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  status: "valid" | "warning" | "expired";
  sans: string[];
  sigAlg: string;
  keyType: string;
  keySize: number | string;
}

interface OriginalFile {
  id: string;
  name: string;
  content: string | Uint8Array;
  type: "text" | "binary";
  displayType: string;
}

const generateRandomPassword = (length = 16) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const classifyFile = (name: string, content: string | Uint8Array, isBinary: boolean) => {
  if (isBinary) {
    if (name.endsWith(".p7b") || name.endsWith(".p7c")) return { type: "P7B Archive" };
    return { type: "PFX Archive" };
  }

  const text = content as string;
  const hasKey = text.includes("PRIVATE KEY");
  const hasCert = text.includes("CERTIFICATE");
  const hasCsr = text.includes("CERTIFICATE REQUEST");

  if (hasKey && hasCert) return { type: "Key & Certificate" };
  if (hasKey) return { type: "Private Key" };
  if (hasCsr) return { type: "CSR" };
  if (hasCert) {
    const certCount = (text.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
    if (certCount > 1 || name.includes("chain") || name.includes("bundle")) return { type: "CA Chain" };
    return { type: "Certificate" };
  }

  return { type: "Unknown" };
};

const parseText = (text: string, current: DetectedItems): DetectedItems => {
  const pemRegex = /-----BEGIN [A-Z\s]+-----[^-]+-----END [A-Z\s]+-----/g;
  const matches = text.match(pemRegex) || [];
  
  let newKey = current.key;
  let newCert = current.cert;
  const newChain = [...current.chain];
  let newCsr = current.csr;

  matches.forEach(pem => {
    if (pem.includes("PRIVATE KEY")) {
      newKey = pem;
    } else if (pem.includes("CERTIFICATE REQUEST")) {
      newCsr = pem;
    } else if (pem.includes("CERTIFICATE")) {
      if (!newCert) {
        newCert = pem;
      } else if (newCert !== pem && !newChain.includes(pem)) {
        newChain.push(pem);
      }
    }
  });

  return { ...current, key: newKey, cert: newCert, chain: newChain, csr: newCsr };
};

export default function SSLToolkitClient() {
  const [detected, setDetected] = useState<DetectedItems>({ key: null, cert: null, chain: [], csr: null, pfx: null });
  const [originalFiles, setOriginalFiles] = useState<OriginalFile[]>([]);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isPfxModalOpen, setIsPfxModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [manualPfxPassword, setManualPfxPassword] = useState("");
  const [confirmPfxPassword, setConfirmPfxPassword] = useState("");

  const sessionPfxPassword = useMemo(() => {
    if (detected.cert && detected.key) return generateRandomPassword();
    return "";
  }, [detected.cert, detected.key]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 4000);
  };

  const rebuildDetected = (files: OriginalFile[]) => {
    let current: DetectedItems = { key: null, cert: null, chain: [], csr: null, pfx: null };
    files.forEach(f => {
      if (f.type === "binary") {
        let binaryString = "";
        const uint8Array = f.content as Uint8Array;
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        current.pfx = { binary: binaryString, passwordValue: "", error: "", filename: f.name };
      } else {
        current = parseText(f.content as string, current);
      }
    });
    setDetected(current);
  };

  const handleFiles = (files: File[]) => {
    const promises = files.map(file => {
      return new Promise<OriginalFile>((resolve) => {
        const isBinary = file.name.endsWith(".pfx") || file.name.endsWith(".p12") || file.type === "application/x-pkcs12" || file.name.endsWith(".p7b");
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (!evt.target?.result) return;
          if (isBinary) {
            const arrayBuffer = evt.target.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            const { type } = classifyFile(file.name, uint8Array, true);
            resolve({ id: Math.random().toString(36).substring(2, 9), name: file.name, content: uint8Array, type: "binary", displayType: type });
          } else {
            const text = evt.target.result as string;
            const { type } = classifyFile(file.name, text, false);
            resolve({ id: Math.random().toString(36).substring(2, 9), name: file.name, content: text, type: "text", displayType: type });
          }
        };
        if (isBinary) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
      });
    });

    Promise.all(promises).then(newOriginals => {
      setOriginalFiles(prev => [...prev, ...newOriginals]);
    });
  };

  // Rebuild detected items whenever original files change
  useEffect(() => {
    rebuildDetected(originalFiles);
  }, [originalFiles]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const pastedText = e.clipboardData?.getData("text");
      if (pastedText && pastedText.trim()) {
        const name = `pasted-ssl-${Date.now()}.txt`;
        const { type } = classifyFile(name, pastedText, false);
        const newFile: OriginalFile = { id: Math.random().toString(36).substring(2, 9), name, content: pastedText, type: "text", displayType: type };
        setOriginalFiles(prev => [...prev, newFile]);
        showStatus("Pasted text loaded");
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDeleteFile = (id: string) => {
    setOriginalFiles(prev => prev.filter(f => f.id !== id));
  };

  const unlockPfx = () => {
    if (!detected.pfx) return;
    try {
      const p12Asn1 = forge.asn1.fromDer(detected.pfx.binary, false);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, detected.pfx.passwordValue);
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
      const unencryptedKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];

      let keyPem = "";
      if (keyBags.length > 0 && keyBags[0].key) keyPem = forge.pki.privateKeyToPem(keyBags[0].key);
      else if (unencryptedKeyBags.length > 0 && unencryptedKeyBags[0].key) keyPem = forge.pki.privateKeyToPem(unencryptedKeyBags[0].key);

      let certPem = "";
      const caPems: string[] = [];
      if (certBags.length > 0 && certBags[0].cert) {
        certPem = forge.pki.certificateToPem(certBags[0].cert);
        for (let i = 1; i < certBags.length; i++) {
          if (certBags[i].cert) caPems.push(forge.pki.certificateToPem(certBags[i].cert!).trim());
        }
      }

      setDetected(prev => ({ ...prev, key: keyPem || prev.key, cert: certPem || prev.cert, chain: [...prev.chain, ...caPems], pfx: null }));
      showStatus("PFX unlocked and extracted!");
    } catch {
      setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, error: "Incorrect password or invalid file." } } : prev);
    }
  };

  const getCertOverview = (pem: string): CertOverview | null => {
    try {
      const cert = forge.pki.certificateFromPem(pem);
      const domain = (cert.subject.attributes.find(a => a.shortName === "CN" || a.name === "commonName")?.value as string) || "Unknown Subject";
      const issuer = (cert.issuer.attributes.find(a => a.shortName === "CN" || a.name === "commonName")?.value as string) || "Unknown Issuer";
      const subjectStr = cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
      
      const now = new Date();
      const validToObj = cert.validity.notAfter;
      const daysLeft = Math.ceil((validToObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let expStatus: "valid" | "warning" | "expired" = "valid";
      if (daysLeft < 0) expStatus = "expired";
      else if (daysLeft < 30) expStatus = "warning";

      const ext = cert.getExtension("subjectAltName");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sans: string[] = ext ? (ext as any).altNames.map((a: any) => a.value as string) : [];
      const sigAlg = forge.pki.oids[cert.signatureOid] || cert.signatureOid;

      let keyType = "Unknown";
      let keySize: number | string = "Unknown";
      if (cert.publicKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pk = cert.publicKey as any;
        if (pk.n) { keyType = "RSA"; keySize = pk.n.bitLength(); }
        else keyType = "ECDSA / Other";
      }

      return { domain, issuer, subject: subjectStr, validFrom: cert.validity.notBefore.toLocaleDateString(), validTo: validToObj.toLocaleDateString(), daysLeft, status: expStatus, sans, sigAlg, keyType, keySize };
    } catch { return null; }
  };

  const baseName = (() => {
    if (detected.cert) {
      const overview = getCertOverview(detected.cert);
      if (overview?.domain && overview.domain !== "Unknown Subject") return overview.domain.replace('*.', '');
    }
    return "ssl-output";
  })();

  const certName = `CERTIFICATE_${baseName}.crt`;
  const keyName = `PRIVATE-KEY_${baseName}.key`;
  const chainName = `CA-CHAIN_${baseName}.pem`;
  const pfxName = `PFX_${baseName}.pfx`;
  const p7bName = `P7B_${baseName}.p7b`;

  const downloadFile = (name: string, content: string, mimeType = "text/plain") => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
    showStatus(`${name} ready`);
  };

  const getP7bBytes = () => {
    if (!detected.cert || detected.chain.length === 0) return null;
    try {
      const p7 = forge.pkcs7.createSignedData();
      p7.addCertificate(forge.pki.certificateFromPem(detected.cert));
      detected.chain.forEach(c => p7.addCertificate(forge.pki.certificateFromPem(c)));
      return forge.pkcs7.messageToPem(p7);
    } catch { return null; }
  };

  const getPfxBytes = (password: string) => {
    if (!detected.cert || !detected.key) return null;
    try {
      const cert = forge.pki.certificateFromPem(detected.cert);
      const key = forge.pki.privateKeyFromPem(detected.key);
      const certChain = [cert];
      detected.chain.forEach(c => certChain.push(forge.pki.certificateFromPem(c)));
      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, certChain, password, { generateLocalKeyId: true, algorithm: "3des" });
      const der = forge.asn1.toDer(p12Asn1).getBytes();
      const array = new Uint8Array(der.length);
      for (let i = 0; i < der.length; i++) array[i] = der.charCodeAt(i);
      return array;
    } catch { return null; }
  };

  const downloadP7bSingle = () => {
    const bytes = getP7bBytes();
    if (bytes) downloadFile(p7bName, bytes);
  };

  const handleDownloadAll = async () => {
    if (originalFiles.length === 0) return;
    const zip = new JSZip();
    const overview = detected.cert ? getCertOverview(detected.cert) : null;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    let certFingerprint = "N/A";
    let serialNumber = "N/A";
    if (detected.cert) {
      try {
        const c = forge.pki.certificateFromPem(detected.cert);
        certFingerprint = forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes()).digest().toHex().toUpperCase().match(/.{1,2}/g)?.join(':') || "N/A";
        serialNumber = c.serialNumber;
      } catch (e) { console.error(e); }
    }

    const readme = [
      "===============================================================================",
      "SSL PACKAGE SUMMARY",
      `Generated by Mi (mi.maker-ai.tech) on ${timestamp} UTC`,
      "===============================================================================",
      "",
      "IDENTITY PROFILE",
      "-------------------------------------------------------------------------------",
      `Common Name (CN):    ${overview?.domain || "N/A"}`,
      `Subject Alt Names:   ${overview?.sans.join(", ") || "None"}`,
      `Certificate Issuer:  ${overview?.issuer || "N/A"}`,
      `Serial Number:       ${serialNumber}`,
      `SHA-256 Fingerprint: ${certFingerprint}`,
      `Encryption Algorithm: ${overview?.keyType || "N/A"} ${overview?.keySize || ""} bits`,
      `Signature Algorithm: ${overview?.sigAlg || "N/A"}`,
      "",
      "VALIDITY PERIOD",
      "-------------------------------------------------------------------------------",
      `Issued On:           ${overview?.validFrom || "N/A"}`,
      `Expires On:          ${overview?.validTo || "N/A"}`,
      `Time Remaining:      ${overview?.daysLeft || 0} days`,
      `Status:              ${overview?.status?.toUpperCase() || "UNKNOWN"}`,
      "",
      "INCLUDED ASSETS",
      "-------------------------------------------------------------------------------",
      detected.cert ? `[X] ${certName.padEnd(30)} | Public Certificate (Base64 PEM)` : "[ ] N/A",
      detected.key  ? `[X] ${keyName.padEnd(30)} | Private Key (RSA/ECC)` : "[ ] N/A",
      detected.chain.length > 0 ? `[X] ${chainName.padEnd(30)} | CA Bundle / Intermediate Chain` : "[ ] N/A",
      detected.cert && detected.key ? `[X] ${pfxName.padEnd(30)} | PKCS#12 Archive (IIS/Azure)` : "[ ] N/A",
      `[X] README.txt                     | Deployment Instructions & Summary`,
      "",
      "-------------------------------------------------------------------------------",
      "SECURITY CREDENTIALS",
      "-------------------------------------------------------------------------------",
      `PFX ARCHIVE PASSWORD: ${sessionPfxPassword || "N/A"}`,
      "NOTE: Keep this password secure. It is required for IIS/Windows imports.",
      "",
      "-------------------------------------------------------------------------------",
      "ENVIRONMENT DEPLOYMENT GUIDE",
      "-------------------------------------------------------------------------------",
      "",
      "1. NGINX (Linux/Unix)",
      "   Combine Certificate and Chain into a single .pem file if not already bundled.",
      "   ssl_certificate     /etc/nginx/ssl/fullchain.pem;",
      "   ssl_certificate_key /etc/nginx/ssl/privkey.key;",
      "",
      "2. APACHE (Linux/Unix)",
      "   SSLCertificateFile    /path/to/cert.crt",
      "   SSLCertificateKeyFile /path/to/key.key",
      "   SSLCertificateChainFile /path/to/chain.pem",
      "",
      "3. IIS / WINDOWS SERVER",
      "   1. Open 'Internet Information Services (IIS) Manager'.",
      "   2. Select the server in the Connections pane.",
      "   3. Double-click 'Server Certificates'.",
      "   4. Click 'Import...' in the Actions pane.",
      "   5. Select the .pfx file and enter the password provided above.",
      "",
      "-------------------------------------------------------------------------------",
      "VALIDATION SUMMARY",
      "-------------------------------------------------------------------------------",
      `Private Key Match:   ${keyMatches === true ? "VALID" : "PENDING/MISMATCH"}`,
      `Chain Integrity:     ${detected.chain.length > 0 ? "ESTABLISHED" : "MISSING"}`,
      "-------------------------------------------------------------------------------",
      "",
      "Processed locally in your browser. No data was transmitted.",
      "Mi - a Maker AI platform (maker-ai.tech)"
    ].join("\n");

    if (detected.cert) zip.file(certName, detected.cert);
    if (detected.key) zip.file(keyName, detected.key);
    if (detected.chain.length > 0) zip.file(chainName, detected.chain.join("\n\n"));
    const p7b = getP7bBytes(); if (p7b) zip.file(p7bName, p7b);
    const pfx = getPfxBytes(sessionPfxPassword); if (pfx) zip.file(pfxName, pfx.buffer);
    zip.file("README.txt", readme);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}-ssl-package.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
    showStatus("Package ready");
  };

  const keyMatches = useMemo(() => {
    if (!detected.cert || !detected.key) return null;
    try {
      const cert = forge.pki.certificateFromPem(detected.cert);
      const key = forge.pki.privateKeyFromPem(detected.key);
      const md = forge.md.sha256.create();
      md.update('test', 'utf8');
      const signature = key.sign(md);
      const verifyMd = forge.md.sha256.create();
      verifyMd.update('test', 'utf8');
      const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
      return publicKey.verify(verifyMd.digest().getBytes(), signature);
    } catch { return false; }
  }, [detected.cert, detected.key]);

  const certOverview = useMemo(() => detected.cert ? getCertOverview(detected.cert) : null, [detected.cert]);

  const chainOverviews = useMemo(() => {
    return detected.chain.map(c => getCertOverview(c)).filter(Boolean) as CertOverview[];
  }, [detected.chain]);

  const hasAnyData = originalFiles.length > 0;
  const clearAll = () => {
    setOriginalFiles([]);
    setDetected({ key: null, cert: null, chain: [], csr: null, pfx: null });
  };

  const downloadPfx = () => {
    const bytes = getPfxBytes(manualPfxPassword);
    if (!bytes) {
      showStatus("Could not build the PFX. Check the key and certificate.");
      return;
    }
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/x-pkcs12" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pfxName;
    a.click();
    window.URL.revokeObjectURL(url);
    setIsPfxModalOpen(false);
    setManualPfxPassword("");
    setConfirmPfxPassword("");
    showStatus("PFX ready");
  };

  const allCerts: { label: string; overview: CertOverview }[] = [];
  if (certOverview) allCerts.push({ label: "Leaf certificate", overview: certOverview });
  chainOverviews.forEach((c, i) => allCerts.push({ label: `CA ${chainOverviews.length - i}`, overview: c }));

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
                <EmptyState icon={<Search className="size-8 text-muted" />} title="No certificate found" hint="Add a .crt or .pem file to see its details." />
              )}
            </GlassCard>

            <GlassCard className="lg:col-span-4 flex flex-col gap-6">
              <SectionTitle icon={<Activity className="size-5 text-accent" />} title="Checks" divider />

              <div className="flex flex-col gap-3">
                <ValidationStatus label="Key matches certificate" status={keyMatches === true ? "success" : keyMatches === false ? "error" : "pending"} successMsg="Match" errorMsg="Mismatch" />
                <ValidationStatus label="Expiry" status={certOverview?.status === "valid" ? "success" : certOverview?.status === "expired" ? "error" : certOverview?.status === "warning" ? "warning" : "pending"} successMsg="Valid" errorMsg="Expired" warningMsg="Expires soon" />
                <ValidationStatus label="CA chain" status={detected.chain.length > 0 ? "success" : "pending"} successMsg="Found" errorMsg="Missing" />
              </div>

              {detected.pfx && (
                <div className="mt-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <Lock className="size-4" />
                    Unlock {detected.pfx.filename}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      aria-label="PFX password"
                      placeholder="PFX password"
                      value={detected.pfx.passwordValue}
                      onChange={(e) => setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, passwordValue: e.target.value } } : prev)}
                      onKeyDown={(e) => { if (e.key === "Enter") unlockPfx(); }}
                      className="toolsy-input h-9 text-sm"
                    />
                    <button onClick={unlockPfx} className="h-9 px-4 rounded-lg bg-amber-500 text-[#1a1000] text-xs font-bold hover:bg-amber-400 transition-colors">Unlock</button>
                  </div>
                  {detected.pfx.error && <p className="text-xs font-semibold text-red-400">{detected.pfx.error}</p>}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* Chain and expiry */}
        {hasAnyData && (detected.chain.length > 0 || detected.cert) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <GlassCard className="lg:col-span-7 flex flex-col gap-6">
              <SectionTitle icon={<Link className="size-5 text-accent" />} title="Certificate chain" divider />

              <div className="flex flex-col gap-1 pl-6 border-l-2 border-accent ml-4">
                {chainOverviews.length > 0 && (
                  <ChainNode label="Root CA" cert={chainOverviews[chainOverviews.length - 1]} />
                )}
                {chainOverviews.slice(0, -1).reverse().map((cert, i) => (
                  <ChainNode key={i} label={`Intermediate CA ${chainOverviews.length - 1 - i}`} cert={cert} />
                ))}
                {certOverview && <ChainNode label="Leaf certificate" cert={certOverview} />}
                {detected.chain.length === 0 && !detected.cert && (
                  <EmptyState icon={<Link className="size-8 text-muted" />} title="No chain data" hint="Add a certificate or CA bundle." />
                )}
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
                  {detected.cert && <DownloadItem icon={<FileCheck className="size-4 text-accent" />} type="Certificate" name={certName} onClick={() => downloadFile(certName, detected.cert!)} />}
                  {detected.key && <DownloadItem icon={<Key className="size-4 text-accent" />} type="Private key" name={keyName} onClick={() => downloadFile(keyName, detected.key!)} />}
                  {detected.chain.length > 0 && <DownloadItem icon={<Link className="size-4 text-accent" />} type="CA chain" name={chainName} onClick={() => downloadFile(chainName, detected.chain.join("\n\n"))} />}
                  {detected.cert && detected.key && keyMatches !== false && <DownloadItem icon={<Package className="size-4 text-accent" />} type="PFX (IIS / Windows)" name={pfxName} onClick={() => setIsPfxModalOpen(true)} action="Set password" />}
                  {detected.cert && detected.chain.length > 0 && <DownloadItem icon={<FileText className="size-4 text-accent" />} type="P7B (Java / import)" name={p7bName} onClick={downloadP7bSingle} />}
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="p-6 rounded-2xl bg-surface border border-accent flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-foreground">Full package</h3>
                    <p className="text-sm text-muted">Renamed, matched and bundled as a single ZIP.</p>
                  </div>
                  <button onClick={handleDownloadAll} className="w-full py-3 rounded-xl bg-accent text-[#04181a] font-bold text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2">
                    <Download className="size-4" />
                    Download ZIP
                  </button>
                  <p className="text-xs text-muted leading-relaxed">
                    Includes a README with install steps and the generated PFX password.
                  </p>
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
                  <li><strong>Detection:</strong> recognises CRT, KEY, PEM, PFX and P7B files.</li>
                  <li><strong>Key check:</strong> verifies that a private key matches a certificate.</li>
                  <li><strong>Chain view:</strong> lists the CA certificates and their expiry dates.</li>
                  <li><strong>Packaging:</strong> exports a ZIP with consistent file names.</li>
                </ul>
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
  if (type === "CA Chain") return <Link className={cls} />;
  if (type === "Unknown") return <HelpCircle className={cls} />;
  return <FileCheck className={cls} />;
}

function ValidationStatus({ label, status, successMsg, errorMsg, warningMsg }: { label: string; status: "success" | "error" | "warning" | "pending"; successMsg: string; errorMsg: string; warningMsg?: string }) {
  const configs = {
    success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", msg: successMsg },
    error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", msg: errorMsg },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", msg: warningMsg },
    pending: { icon: Activity, color: "text-muted", bg: "bg-surface", msg: "Not checked" },
  };
  const config = configs[status];
  const Icon = config.icon;
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-border">
      <span className="text-xs text-muted">{label}</span>
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bg} ${config.color}`}>
        <Icon className="size-3.5" />
        <span className="text-xs font-semibold">{config.msg}</span>
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
