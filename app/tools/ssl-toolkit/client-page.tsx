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
import { motion, AnimatePresence } from "framer-motion";
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
  icon: string;
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
    if (name.endsWith('.p7b') || name.endsWith('.p7c')) return { type: "P7B Archive", icon: "📚" };
    return { type: "PFX Archive", icon: "📦" };
  }
  
  const text = content as string;
  const hasKey = text.includes("PRIVATE KEY");
  const hasCert = text.includes("CERTIFICATE");
  const hasCsr = text.includes("CERTIFICATE REQUEST");
  
  if (hasKey && hasCert) return { type: "Key & Certificate", icon: "🔑📄" };
  if (hasKey) return { type: "Private Key", icon: "🔑" };
  if (hasCert) {
    const certCount = (text.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
    if (certCount > 1 || name.includes("chain") || name.includes("bundle")) return { type: "CA Chain", icon: "🔗" };
    return { type: "Certificate", icon: "📄" };
  }
  if (hasCsr) return { type: "CSR", icon: "📝" };
  
  return { type: "Unknown", icon: "❓" };
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
            const { type, icon } = classifyFile(file.name, uint8Array, true);
            resolve({ id: Math.random().toString(36).substring(2, 9), name: file.name, content: uint8Array, type: "binary", displayType: type, icon });
          } else {
            const text = evt.target.result as string;
            const { type, icon } = classifyFile(file.name, text, false);
            resolve({ id: Math.random().toString(36).substring(2, 9), name: file.name, content: text, type: "text", displayType: type, icon });
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
        const { type, icon } = classifyFile(name, pastedText, false);
        const newFile: OriginalFile = { id: Math.random().toString(36).substring(2, 9), name, content: pastedText, type: "text", displayType: type, icon };
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
    showStatus(`✅ ${name} ready`);
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
      "SSL DEPLOYMENT PACKAGE SUMMARY",
      `Generated by Mi OS on ${timestamp} UTC`,
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
      "Forensic data processed strictly in local sandbox. No data transmitted.",
      "Mi OS - Security Core v2.0 by maker-ai.tech"
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
    showStatus(`✅ Package ready`);
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

  const hasAnyData = originalFiles.length > 0;

  return (
    <ToolContainer categoryId="network-security">
      <ToolHeader
        title="SSL Toolkit"
        description="A tactical file organizer and validator for your SSL certificates. Align, match, and structure your messy SSL traces instantly."
        categoryId="network-security"
      />

      <div className="flex flex-col gap-10">
        
        {/* SECTION 1: UPLOAD & INGESTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <GlassCard className="xl:col-span-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="size-5 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em]">Ingestion Node</h2>
              </div>
              {hasAnyData && (
                <button onClick={() => { setOriginalFiles([]); setDetected({ key: null, cert: null, chain: [], csr: null, pfx: null }); }} className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-red-400 transition-colors">
                  Flush All
                </button>
              )}
            </div>

            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }}
              className={`relative h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-500 cursor-pointer group ${
                isDragging ? "border-accent bg-accent/5" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-col items-center gap-3 text-center pointer-events-none px-6">
                <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform">
                  <Plus className={`size-6 ${isDragging ? "text-accent" : "text-muted/40"}`} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-foreground">Drop SSL Files Here</p>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Supports .crt, .key, .pem, .pfx, and .p7b</p>
                </div>
              </div>
              <input type="file" multiple onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ''; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>

            {status && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/5 self-center px-4 py-2 rounded-full border border-accent/10">
                {status}
              </motion.div>
            )}
          </GlassCard>

          <GlassCard className="xl:col-span-5 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Activity className="size-5 text-emerald-400" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em]">Stream Analysis</h2>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[190px] overflow-y-auto custom-scrollbar">
              {originalFiles.length > 0 ? (
                originalFiles.map(file => (
                  <div key={file.id} className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-lg">{file.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-foreground truncate">{file.name}</span>
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest">{file.displayType}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteFile(file.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-20 italic text-[10px] uppercase font-black tracking-widest">
                  Awaiting Input Data
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* SECTION 2: IDENTITY & VALIDATION */}
        {hasAnyData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            <GlassCard className="lg:col-span-8 flex flex-col gap-8">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <ShieldCheck className="size-5 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em]">Certificate Identity</h2>
              </div>

              {certOverview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Common Name (Domain)</label>
                      <p className="text-sm font-black text-foreground break-all">{certOverview.domain}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Issuer</label>
                      <p className="text-[11px] font-bold text-muted leading-relaxed break-all">{certOverview.issuer}</p>
                    </div>
                    {certOverview.sans.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Alternative Names (SAN)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {certOverview.sans.slice(0, 8).map((san, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-muted font-mono">{san}</span>
                          ))}
                          {certOverview.sans.length > 8 && <span className="text-[9px] font-black text-muted/40">+{certOverview.sans.length - 8} More</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Valid From</label>
                        <p className="text-[11px] font-black text-foreground">{certOverview.validFrom}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Expiry Date</label>
                        <p className={`text-[11px] font-black ${certOverview.status === 'expired' ? 'text-red-400' : 'text-foreground'}`}>{certOverview.validTo}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/20 border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">Time Remaining</span>
                        {certOverview.status === 'valid' ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Clock className="size-3 text-amber-400" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black ${certOverview.daysLeft < 30 ? 'text-amber-400' : 'text-emerald-400'} ${certOverview.daysLeft < 0 ? 'text-red-400' : ''}`}>
                          {certOverview.daysLeft}
                        </span>
                        <span className="text-[10px] font-black uppercase text-muted/60 tracking-widest">Days Left</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Key Params</label>
                        <p className="text-[10px] font-black text-muted uppercase">{certOverview.keyType} {certOverview.keySize} BIT</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted/60">Sig Algorithm</label>
                        <p className="text-[10px] font-bold text-muted break-all uppercase tracking-tighter">{certOverview.sigAlg}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                  <Search className="size-8 mb-3 text-muted/20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Upload a certificate to reveal identity</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="lg:col-span-4 flex flex-col gap-8 bg-accent/5 border-accent/10">
              <div className="flex items-center gap-3 border-b border-accent/10 pb-4">
                <Activity className="size-5 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em]">Module Health</h2>
              </div>

              <div className="flex flex-col gap-4">
                <ValidationStatus label="Private Key Pair" status={keyMatches === true ? 'success' : keyMatches === false ? 'error' : 'pending'} successMsg="Perfect Match" errorMsg="Mismatched Pair" />
                <ValidationStatus label="Expiry Status" status={certOverview?.status === 'valid' ? 'success' : certOverview?.status === 'expired' ? 'error' : certOverview?.status === 'warning' ? 'warning' : 'pending'} successMsg="Valid Trace" errorMsg="Expired" warningMsg="Expires Soon" />
                <ValidationStatus label="Chain Integrity" status={detected.chain.length > 0 ? 'success' : 'pending'} successMsg="Bundle Found" errorMsg="No Chain" />
              </div>

              {detected.pfx && (
                <div className="mt-auto p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-4 animate-fadeIn">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    <Lock className="size-3.5" />
                    Unlock PFX Archive
                  </div>
                  <div className="flex gap-2">
                    <input type="password" placeholder="Keyhole password..." value={detected.pfx.passwordValue} onChange={(e) => setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, passwordValue: e.target.value } } : prev)} className="toolsy-input h-9 text-[11px] bg-black/40 border-amber-500/20 focus:border-amber-500/40" />
                    <button onClick={unlockPfx} className="h-9 px-4 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Unlock</button>
                  </div>
                  {detected.pfx.error && <p className="text-[9px] font-bold text-red-400 uppercase">{detected.pfx.error}</p>}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* SECTION 3: TACTICAL EXPORT */}
        {hasAnyData && (
          <GlassCard className="flex flex-col gap-8 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <Package className="size-5 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em]">Tactical Export</h2>
              </div>
              <button onClick={() => setIsDocModalOpen(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors">
                <HelpCircle className="size-3.5" />
                Documentation
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 flex flex-col gap-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted/60 mb-1">Discrete Module Download</label>
                <div className="flex flex-col gap-2">
                  {detected.cert && <DownloadItem icon={<FileCheck className="size-4 text-cyan-400" />} type="Certificate" name={certName} onClick={() => downloadFile(certName, detected.cert!)} />}
                  {detected.key && <DownloadItem icon={<Key className="size-4 text-purple-400" />} type="Private Key" name={keyName} onClick={() => downloadFile(keyName, detected.key!)} />}
                  {detected.chain.length > 0 && <DownloadItem icon={<Link className="size-4 text-blue-400" />} type="CA Chain" name={chainName} onClick={() => downloadFile(chainName, detected.chain.join("\n\n"))} />}
                  {detected.cert && detected.key && keyMatches !== false && <DownloadItem icon={<Package className="size-4 text-emerald-400" />} type="PFX (IIS/Windows)" name={pfxName} onClick={() => setIsPfxModalOpen(true)} action="Configure" />}
                  {detected.cert && detected.chain.length > 0 && <DownloadItem icon={<FileText className="size-4 text-amber-400" />} type="P7B (Java/Import)" name={p7bName} onClick={downloadP7bSingle} />}
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="p-8 rounded-3xl bg-accent/10 border border-accent/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Download className="size-24" />
                  </div>
                  <div className="flex flex-col gap-6 relative z-10">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Full System Package</h3>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Renamed, matched, and structured for production</p>
                    </div>
                    <button onClick={handleDownloadAll} className="w-full py-4 rounded-xl bg-accent text-black font-black uppercase tracking-[0.2em] text-xs hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                      <Download className="size-4" />
                      Export Zip Package
                    </button>
                    <p className="text-[10px] font-bold text-muted/60 uppercase tracking-widest leading-relaxed">
                      Includes README.txt with installation instructions and PFX passwords.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* REFINED FOOTER */}
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">SSL Toolkit v2.0</span>
            <div className="h-3 w-px bg-white/10 hidden md:block" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Encrypted Local Computation Only</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDocModalOpen(true)} className="text-[10px] font-black uppercase tracking-widest hover:text-accent transition-colors">Operation Manual</button>
            <div className="h-1 w-1 rounded-full bg-accent" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Mi OS Native</p>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isPfxModalOpen && (
          <Modal title="Secure PFX Archive" onClose={() => { setIsPfxModalOpen(false); setManualPfxPassword(""); setConfirmPfxPassword(""); }}>
            <div className="flex flex-col gap-6">
              <p className="text-xs font-medium text-muted leading-relaxed">Please set a password to encrypt your Private Key before generating the PFX archive. This password will be required when importing the file into IIS or Windows.</p>
              <div className="flex flex-col gap-3">
                <input type="password" placeholder="Encryption password" value={manualPfxPassword} onChange={(e) => setManualPfxPassword(e.target.value)} className="toolsy-input h-11 px-4 text-sm" />
                <input type="password" placeholder="Confirm password" value={confirmPfxPassword} onChange={(e) => setConfirmPfxPassword(e.target.value)} className="toolsy-input h-11 px-4 text-sm" />
                {manualPfxPassword && confirmPfxPassword && manualPfxPassword !== confirmPfxPassword && <p className="text-[10px] font-bold text-red-400 uppercase">Passwords do not match</p>}
              </div>
              <button onClick={() => { const bytes = getPfxBytes(manualPfxPassword); if (bytes) { const blob = new Blob([bytes.buffer], { type: "application/x-pkcs12" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = pfxName; a.click(); window.URL.revokeObjectURL(url); setIsPfxModalOpen(false); showStatus("✅ PFX Ready"); } }} disabled={!manualPfxPassword || manualPfxPassword !== confirmPfxPassword} className="w-full py-4 rounded-xl bg-accent text-black font-black uppercase tracking-[0.2em] text-xs disabled:opacity-30 transition-all">Download PFX</button>
            </div>
          </Modal>
        )}

        {isDocModalOpen && (
          <Modal title="Operation Manual" onClose={() => setIsDocModalOpen(false)}>
            <div className="flex flex-col gap-8 text-[11px] font-medium text-muted leading-relaxed max-h-[60svh] overflow-y-auto custom-scrollbar pr-4">
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Mission Statement</h4>
                <p>The SSL Toolkit is a forensic file organizer designed to fix the &quot;folder of nameless files&quot; problem. It identifies, matches, and renames your SSL components into a structured production-ready package.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Capabilities</h4>
                <ul className="flex flex-col gap-2 list-disc list-inside">
                  <li><strong>Heuristic Identification:</strong> Auto-detects CRT, KEY, PEM, and PFX types.</li>
                  <li><strong>Pair Validation:</strong> Cryptographically verifies if a Private Key matches a Certificate.</li>
                  <li><strong>Chain Inspection:</strong> Validates CA Bundle integrity and leaf-issuer relationships.</li>
                  <li><strong>Package Generation:</strong> Exports structured ZIPs with clear naming conventions.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Privacy Protocol</h4>
                <p>All processing occurs strictly in your browser&apos;s local sandbox via Node-Forge. Your private keys never touch our servers. Systems are offline-first by design.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Export Formats</h4>
                <ul className="flex flex-col gap-2">
                  <li><span className="text-cyan-400 font-bold">CRT/PEM:</span> Standard formats for Nginx, Apache, and Cloudflare.</li>
                  <li><span className="text-emerald-400 font-bold">PFX:</span> Binary PKCS#12 for IIS, Windows, and Azure.</li>
                  <li><span className="text-amber-400 font-bold">P7B:</span> PKCS#7 for Java (Tomcat) and standard Windows imports.</li>
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
   HELPER COMPONENTS
  ───────────────────────────────────────────── */

function ValidationStatus({ label, status, successMsg, errorMsg, warningMsg }: { label: string, status: 'success' | 'error' | 'warning' | 'pending', successMsg: string, errorMsg: string, warningMsg?: string }) {
  const configs = {
    success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', msg: successMsg },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', msg: errorMsg },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', msg: warningMsg },
    pending: { icon: Activity, color: 'text-muted/40', bg: 'bg-white/5', msg: 'Awaiting Trace' }
  };
  const config = configs[status];
  const Icon = config.icon;
  return (
    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">{label}</span>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.color} border border-current/10`}>
        <Icon className="size-3" />
        <span className="text-[9px] font-black uppercase tracking-tighter">{config.msg}</span>
      </div>
    </div>
  );
}

function DownloadItem({ icon, type, name, onClick, action = "Download" }: { icon: React.ReactNode, type: string, name: string, onClick: () => void, action?: string }) {
  return (
    <div onClick={onClick} className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2 rounded-lg bg-white/5">{icon}</div>
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-black text-muted uppercase tracking-widest mb-0.5">{type}</span>
          <span className="text-[11px] font-bold text-foreground truncate max-w-[200px] md:max-w-md">{name}</span>
        </div>
      </div>
      <button className="text-[10px] font-black uppercase tracking-widest text-accent opacity-0 group-hover:opacity-100 transition-opacity ml-4">
        {action}
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-[#0A0A0A] shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div className="p-8 md:p-12 relative z-10 flex flex-col gap-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">{title}</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-muted transition-colors"><X className="size-5" /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
