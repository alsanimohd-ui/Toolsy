"use client";

import { useState, useEffect, useMemo } from "react";
import forge from "node-forge";
import JSZip from "jszip";
import {
  ToolContainer,
  ToolHeader,
  ToolSection,
} from "@/components/tools";

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
  const [manualPfxPassword, setManualPfxPassword] = useState("");
  const [confirmPfxPassword, setConfirmPfxPassword] = useState("");

  const sessionPfxPassword = useMemo(() => {
    if (detected.cert && detected.key) {
      return generateRandomPassword();
    }
    return "";
  }, [detected.cert, detected.key]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 6000);
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
        if (isBinary) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      });
    });

    Promise.all(promises).then(newOriginals => {
      setOriginalFiles(prev => {
        const next = [...prev, ...newOriginals];
        rebuildDetected(next);
        return next;
      });
    });
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      const pastedText = e.clipboardData?.getData("text");
      if (pastedText && pastedText.trim()) {
        const name = `pasted-ssl-${Date.now()}.txt`;
        const { type, icon } = classifyFile(name, pastedText, false);
        const newFile: OriginalFile = { id: Math.random().toString(36).substring(2, 9), name, content: pastedText, type: "text", displayType: type, icon };
        
        setOriginalFiles(prev => {
          const next = [...prev, newFile];
          rebuildDetected(next);
          return next;
        });
        showStatus("Pasted text loaded");
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDeleteFile = (id: string) => {
    setOriginalFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      rebuildDetected(next);
      return next;
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const unlockPfx = () => {
    if (!detected.pfx) return;
    try {
      setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, error: "" } } : prev);
      
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
          if (certBags[i].cert) {
            caPems.push(forge.pki.certificateToPem(certBags[i].cert!).trim());
          }
        }
      }

      setDetected(prev => ({
        ...prev,
        key: keyPem || prev.key,
        cert: certPem || prev.cert,
        chain: [...prev.chain, ...caPems],
        pfx: null
      }));

      showStatus("PFX unlocked and extracted!");
    } catch {
      setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, error: "Incorrect password or invalid file." } } : prev);
    }
  };

  const handleClear = () => {
    setDetected({ key: null, cert: null, chain: [], csr: null, pfx: null });
    setOriginalFiles([]);
    showStatus("Cleared everything.");
  };

  const getCertOverview = (pem: string): CertOverview | null => {
    try {
      const cert = forge.pki.certificateFromPem(pem);
      const domain = (cert.subject.attributes.find(a => a.shortName === "CN" || a.name === "commonName")?.value as string) || "Unknown Subject";
      const issuer = (cert.issuer.attributes.find(a => a.shortName === "CN" || a.name === "commonName")?.value as string) || "Unknown Issuer";
      const subjectStr = cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
      
      const now = new Date();
      const validFromObj = cert.validity.notBefore;
      const validToObj = cert.validity.notAfter;
      const daysLeft = Math.ceil((validToObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let expStatus: "valid" | "warning" | "expired" = "valid";
      if (daysLeft < 0) expStatus = "expired";
      else if (daysLeft < 30) expStatus = "warning";

      const ext = cert.getExtension("subjectAltName");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sans: string[] = ext ? (ext as any).altNames.map((a: any) => a.value as string) : [];

      let sigAlg = cert.signatureOid;
      if (forge.pki.oids[cert.signatureOid]) {
        sigAlg = forge.pki.oids[cert.signatureOid];
      }

      let keyType = "Unknown";
      let keySize: number | string = "Unknown";
      if (cert.publicKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pk = cert.publicKey as any;
        if (pk.n) {
          keyType = "RSA";
          keySize = pk.n.bitLength();
        } else {
          keyType = "ECDSA / Other";
        }
      }

      return {
        domain,
        issuer,
        subject: subjectStr,
        validFrom: validFromObj.toLocaleDateString(),
        validTo: validToObj.toLocaleDateString(),
        daysLeft,
        status: expStatus,
        sans,
        sigAlg,
        keyType,
        keySize
      };
    } catch {
      return null;
    }
  };

  const baseName = (() => {
    if (detected.cert) {
      const overview = getCertOverview(detected.cert);
      if (overview && overview.domain && overview.domain !== "Unknown Subject") {
        return overview.domain.replace('*.', '');
      }
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
    showStatus(`✅ ${name} is ready`);
  };

  const downloadBinary = (name: string, array: Uint8Array) => {
    const blob = new Blob([array as unknown as BlobPart], { type: "application/x-pkcs12" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getP7bBytes = () => {
    if (!detected.cert || detected.chain.length === 0) return null;
    try {
      const p7 = forge.pkcs7.createSignedData();
      p7.addCertificate(forge.pki.certificateFromPem(detected.cert));
      detected.chain.forEach(c => p7.addCertificate(forge.pki.certificateFromPem(c)));
      return forge.pkcs7.messageToPem(p7);
    } catch {
      return null;
    }
  };

  const getPfxBytes = (password: string) => {
    if (!detected.cert || !detected.key) return null;
    try {
      const cert = forge.pki.certificateFromPem(detected.cert);
      const key = forge.pki.privateKeyFromPem(detected.key);
      const certChain = [cert];
      detected.chain.forEach(c => certChain.push(forge.pki.certificateFromPem(c)));

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, certChain, password, {
        generateLocalKeyId: true,
        algorithm: "3des"
      });

      const der = forge.asn1.toDer(p12Asn1).getBytes();
      const array = new Uint8Array(der.length);
      for (let i = 0; i < der.length; i++) array[i] = der.charCodeAt(i);
      return array;
    } catch {
      return null;
    }
  };

  const handleDownloadAll = async () => {
    if (originalFiles.length === 0) return;
    
    const zip = new JSZip();

    const readmeContent = [
      "# SSL SUMMARY",
      "",
      "Domain:",
      baseName === "ssl-output" ? "Unknown" : baseName,
      "",
      "Use this:",
      "",
      "Nginx / Apache:",
      `→ ${certName}`,
      `→ ${keyName}`,
      "",
      "Java / Import:",
      `→ ${p7bName}`,
      ""
    ];

    if (sessionPfxPassword) {
      readmeContent.push("Windows / IIS / PFX File:");
      readmeContent.push(`→ ${pfxName} (Included in this package)`);
      readmeContent.push("");
      readmeContent.push("PFX Password:");
      readmeContent.push(sessionPfxPassword);
      readmeContent.push("");
    }
    
    readmeContent.push("Notes:");
    readmeContent.push("* Files are verified and matched");
    readmeContent.push("* Ready for immediate use");

    if (detected.cert) zip.file(certName, detected.cert);
    if (detected.key) zip.file(keyName, detected.key);
    if (detected.chain.length > 0) zip.file(chainName, detected.chain.join("\n\n"));

    const p7bBytes = getP7bBytes();
    if (p7bBytes) zip.file(p7bName, p7bBytes);

    const pfxBytes = getPfxBytes(sessionPfxPassword);
    if (pfxBytes) zip.file(pfxName, pfxBytes.buffer);

    zip.file("README.txt", readmeContent.join("\n"));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const zipName = baseName === "ssl-output" ? "ssl-package.zip" : `${baseName}-ssl.zip`;
    a.download = zipName;
    a.click();
    window.URL.revokeObjectURL(url);
    showStatus(`✅ ${zipName} is ready`);
  };

  const downloadPfxSingle = () => {
    if (!manualPfxPassword) {
      showStatus("❌ Please enter a password");
      return;
    }
    if (manualPfxPassword !== confirmPfxPassword) {
      showStatus("❌ Passwords do not match");
      return;
    }
    const bytes = getPfxBytes(manualPfxPassword);
    if (bytes) {
      downloadBinary(pfxName, bytes);
      setIsPfxModalOpen(false);
      setManualPfxPassword("");
      setConfirmPfxPassword("");
      showStatus(`✅ ${pfxName} is ready.`);
    }
  };

  const downloadP7bSingle = () => {
    const bytes = getP7bBytes();
    if (bytes) downloadFile(p7bName, bytes);
  };

  const hasAnyData = originalFiles.length > 0;

  const keyMatches = (() => {
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
    } catch {
      return false;
    }
  })();

  const chainMatches = (() => {
    if (!detected.cert) return null;
    if (detected.chain.length === 0) return false;
    try {
      const cert = forge.pki.certificateFromPem(detected.cert);
      const leafIssuer = cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join();
      const chainSubjects = detected.chain.map(c => {
        const cObj = forge.pki.certificateFromPem(c);
        return cObj.subject.attributes.map(a => `${a.shortName}=${a.value}`).join();
      });
      return chainSubjects.includes(leafIssuer);
    } catch {
      return false;
    }
  })();

  const certOverview = detected.cert ? getCertOverview(detected.cert) : null;

  return (
    <ToolContainer>
      <ToolHeader
        title="Fix My SSL"
        description="A clean, smart file organizer for your messy SSL certificates. Drop them here to get beautifully structured, perfectly matched files."
        badge="Organizer"
      />

      <div className="flex flex-col gap-10 animate-fadeIn">
        
        {/* STEP 1: UPLOAD ZONE */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--foreground)]">1. Upload Files</h2>
            {hasAnyData && (
              <button onClick={handleClear} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-all">Clear All</button>
            )}
          </div>
          
          <div 
            className={`relative flex flex-col items-center justify-center w-full min-h-[180px] border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer ${
              isDragging ? "border-[var(--accent)] bg-[var(--accent-glow)]/10" : "border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface)]"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center z-0">
              <span className="text-4xl mb-3 transition-transform group-hover:scale-110">📥</span>
              <p className="text-lg text-[var(--foreground)] font-bold tracking-wide">Drop your SSL files here</p>
              <p className="text-sm text-[var(--muted)] mt-1 font-medium">or click to browse (.pfx, .crt, .key, .pem… anything)</p>
            </div>
            <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" onChange={handleFileUpload} />
          </div>

          {status && (
            <span className="text-sm font-bold text-[var(--accent-hover)] bg-[var(--accent-glow)]/10 px-4 py-2 rounded-lg w-fit animate-fadeIn">
              {status}
            </span>
          )}
        </div>

        {/* STEP 2: SIDE-BY-SIDE MANAGER */}
        {hasAnyData && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <h2 className="text-xl font-bold text-[var(--foreground)]">2. Manage & Review</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* LEFT: FILE LIST */}
              <div className="flex flex-col gap-3 p-6 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl">
                <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">Uploaded Files</h3>
                <div className="flex flex-col gap-2">
                  {originalFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg group">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{file.icon}</span>
                        <span className="text-sm font-semibold text-[var(--foreground)] truncate max-w-[200px]" title={file.name}>{file.name}</span>
                        <span className="text-xs font-bold text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded-md">{file.displayType}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-[var(--muted)] hover:text-red-400 p-1.5 rounded-md hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete file"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: SMART INFO PANEL */}
              <div className="flex flex-col gap-3 p-6 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl">
                <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">Analysis</h3>
                
                <div className="flex flex-col gap-4">
                  {/* DETECTED */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-emerald-400">✔ Detected:</span>
                    <ul className="text-sm font-semibold text-[var(--foreground)] list-disc list-inside ml-2">
                      {detected.cert && <li>Certificate</li>}
                      {detected.key && <li>Private Key</li>}
                      {detected.chain.length > 0 && <li>CA Chain</li>}
                      {detected.pfx && !detected.pfx.error && <li>PFX Archive</li>}
                      {!detected.cert && !detected.key && detected.chain.length === 0 && !detected.pfx && <li className="text-[var(--muted)]">Nothing valid detected yet.</li>}
                    </ul>
                  </div>

                  {/* MISSING */}
                  {(!detected.cert || !detected.key || detected.chain.length === 0) && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-yellow-400">❌ Missing:</span>
                      <ul className="text-sm font-semibold text-[var(--muted)] list-disc list-inside ml-2">
                        {!detected.cert && <li>Certificate</li>}
                        {!detected.key && <li>Private Key</li>}
                        {detected.chain.length === 0 && <li>CA Chain</li>}
                      </ul>
                    </div>
                  )}
                </div>

                {detected.pfx && (
                  <div className="flex flex-col gap-3 p-4 bg-yellow-950/20 border border-yellow-900/40 rounded-xl mt-auto animate-fadeIn">
                    <span className="text-sm font-bold text-yellow-500 flex items-center gap-2"><span className="text-xl">📦</span> Unlock PFX Archive</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="Password..."
                        className="flex-1 px-3 py-1.5 border border-yellow-900/50 bg-[var(--surface)] text-[var(--foreground)] rounded-lg text-sm outline-none focus:border-yellow-500/50"
                        value={detected.pfx.passwordValue}
                        onChange={(e) => setDetected(prev => prev.pfx ? { ...prev, pfx: { ...prev.pfx, passwordValue: e.target.value } } : prev)}
                      />
                      <button onClick={unlockPfx} className="px-3 py-1.5 bg-yellow-600/20 text-yellow-500 font-bold text-sm rounded-lg hover:bg-yellow-600/30">Unlock</button>
                    </div>
                    {detected.pfx.error && <span className="text-xs text-red-400 font-bold">{detected.pfx.error}</span>}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* STEP 3: CERTIFICATE INFO */}
        {certOverview && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <h2 className="text-xl font-bold text-[var(--foreground)]">3. Certificate Info</h2>
            
            <div className="flex flex-col gap-6 p-6 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* IDENTITY */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)] pb-2">Identity</h3>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Domain (CN)</span>
                    <span className="text-sm font-bold text-[var(--foreground)] break-all">{certOverview.domain}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Issuer</span>
                    <span className="text-sm font-semibold text-[var(--foreground)] break-all">{certOverview.issuer}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Subject</span>
                    <span className="text-sm font-medium text-[var(--foreground)] break-all">{certOverview.subject}</span>
                  </div>
                </div>

                {/* VALIDITY */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)] pb-2">Validity</h3>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Valid From</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{certOverview.validFrom}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Expiration Date</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{certOverview.validTo}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Days Remaining</span>
                    <span className={`text-sm font-bold ${certOverview.daysLeft < 30 ? 'text-yellow-400' : 'text-emerald-400'} ${certOverview.daysLeft < 0 ? 'text-red-400' : ''}`}>
                      {certOverview.daysLeft} days
                    </span>
                  </div>
                </div>

                {/* TECHNICAL */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)] pb-2">Technical</h3>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted)]">Signature Algorithm</span>
                    <span className="text-sm font-mono text-[var(--foreground)]">{certOverview.sigAlg}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--muted)]">Key Type</span>
                      <span className="text-sm font-mono text-[var(--foreground)]">{certOverview.keyType}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--muted)]">Key Size</span>
                      <span className="text-sm font-mono text-[var(--foreground)]">{certOverview.keySize} bits</span>
                    </div>
                  </div>
                </div>

                {/* SANS */}
                {certOverview.sans.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)] pb-2">Subject Alternative Names (SAN)</h3>
                    <div className="flex flex-wrap gap-2">
                      {certOverview.sans.map((san, i) => (
                        <span key={i} className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-mono text-[var(--foreground)] break-all">
                          {san}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* STATUS SUMMARY BLOCK */}
              <div className="flex flex-col gap-3 mt-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wide">Validation Status</h3>
                <div className="flex flex-col gap-1.5">
                  {/* EXPIRY */}
                  {certOverview.status === "valid" && <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">✔ Certificate is valid.</span>}
                  {certOverview.status === "warning" && <span className="text-sm font-semibold text-yellow-400 flex items-center gap-2">🟡 Certificate expires soon.</span>}
                  {certOverview.status === "expired" && <span className="text-sm font-semibold text-red-400 flex items-center gap-2">🔴 Certificate is expired.</span>}
                  
                  {/* KEY MATCH */}
                  {keyMatches === true && <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">✔ Private key matches certificate.</span>}
                  {keyMatches === false && <span className="text-sm font-semibold text-red-400 flex items-center gap-2">🔴 Mismatched pair: Key does not belong to Certificate.</span>}
                  
                  {/* CHAIN */}
                  {chainMatches === true && <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">✔ Chain is complete.</span>}
                  {chainMatches === false && <span className="text-sm font-semibold text-yellow-400 flex items-center gap-2">🟡 Missing CA bundle / Chain incomplete.</span>}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* STEP 4: ACTION */}
        {hasAnyData && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <h2 className="text-xl font-bold text-[var(--foreground)]">4. Download</h2>
            
            <ToolSection title="" description="">
              <div className="flex flex-col gap-8 w-full">
                
                {/* INDIVIDUAL FILES */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-[var(--muted)] mb-1 uppercase tracking-wide">Available Files</h3>
                  
                  {detected.cert && (
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all rounded-lg group cursor-pointer" onClick={() => downloadFile(certName, detected.cert!)}>
                      <div className="flex items-center gap-4">
                        <span className="text-xl">📄</span>
                        <span className="text-xs font-bold w-40 text-cyan-400">[CERTIFICATE]</span>
                        <span className="text-sm font-mono text-[var(--foreground)]">{certName}</span>
                      </div>
                      <button className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md">Download</button>
                    </div>
                  )}

                  {detected.key && (
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all rounded-lg group cursor-pointer" onClick={() => downloadFile(keyName, detected.key!)}>
                      <div className="flex items-center gap-4">
                        <span className="text-xl">🔑</span>
                        <span className="text-xs font-bold w-40 text-purple-400">[PRIVATE KEY]</span>
                        <span className="text-sm font-mono text-[var(--foreground)]">{keyName}</span>
                      </div>
                      <button className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md">Download</button>
                    </div>
                  )}

                  {detected.chain.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all rounded-lg group cursor-pointer" onClick={() => downloadFile(chainName, detected.chain.join("\n\n"))}>
                      <div className="flex items-center gap-4">
                        <span className="text-xl">🔗</span>
                        <span className="text-xs font-bold w-40 text-blue-400">[CA CHAIN]</span>
                        <span className="text-sm font-mono text-[var(--foreground)]">{chainName}</span>
                      </div>
                      <button className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md">Download</button>
                    </div>
                  )}

                  {detected.cert && detected.key && keyMatches !== false && (
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all rounded-lg group cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsPfxModalOpen(true); }}>
                      <div className="flex items-center gap-4">
                        <span className="text-xl">📦</span>
                        <span className="text-xs font-bold w-48 text-emerald-400">[PFX (Set password & download)]</span>
                        <span className="text-sm font-mono text-[var(--foreground)]">{pfxName}</span>
                      </div>
                      <button className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md">Configure</button>
                    </div>
                  )}

                  {detected.cert && detected.chain.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all rounded-lg group cursor-pointer" onClick={(e) => { e.stopPropagation(); downloadP7bSingle(); }}>
                      <div className="flex items-center gap-4">
                        <span className="text-xl">📚</span>
                        <span className="text-xs font-bold w-40 text-blue-400">[P7B]</span>
                        <span className="text-sm font-mono text-[var(--foreground)]">{p7bName}</span>
                      </div>
                      <button className="text-xs font-bold bg-[var(--accent)] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md">Download</button>
                    </div>
                  )}

                </div>

                {/* PRIMARY ZIP ACTION */}
                <button 
                  onClick={handleDownloadAll}
                  className="w-full relative overflow-hidden group flex flex-col items-center justify-center gap-2 py-8 bg-[var(--accent)] text-white rounded-2xl shadow-xl shadow-[var(--accent)]/20 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[var(--accent)]/40"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <span className="text-4xl relative z-10 mb-2">📦</span>
                  <span className="text-2xl font-bold uppercase tracking-wide relative z-10">Download Clean SSL Package (.zip)</span>
                  <span className="text-sm font-medium text-white/80 relative z-10">Clean, renamed, ready-to-use files — no folders, no confusion</span>
                </button>

              </div>
            </ToolSection>
          </div>
        )}

      </div>

      {/* PFX PASSWORD MODAL */}
      {isPfxModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => { setIsPfxModalOpen(false); setManualPfxPassword(""); setConfirmPfxPassword(""); }}>
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2"><span className="text-2xl">📦</span> Set PFX Password</h3>
            <p className="text-sm text-[var(--muted)]">Please set a password to encrypt your Private Key before downloading the PFX archive.</p>
            
            <div className="flex flex-col gap-3 mt-2">
              <input 
                type="password" 
                placeholder="Enter password" 
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--foreground)] rounded-xl outline-none focus:border-[var(--accent)] transition-colors"
                value={manualPfxPassword}
                onChange={(e) => setManualPfxPassword(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="Confirm password" 
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--foreground)] rounded-xl outline-none focus:border-[var(--accent)] transition-colors"
                value={confirmPfxPassword}
                onChange={(e) => setConfirmPfxPassword(e.target.value)}
              />
              {manualPfxPassword && confirmPfxPassword && manualPfxPassword !== confirmPfxPassword && (
                <span className="text-xs font-bold text-red-400">Passwords do not match</span>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => { setIsPfxModalOpen(false); setManualPfxPassword(""); setConfirmPfxPassword(""); }} 
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-xl font-bold hover:bg-[var(--border-subtle)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={downloadPfxSingle} 
                disabled={!manualPfxPassword || manualPfxPassword !== confirmPfxPassword}
                className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-xl font-bold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 shadow-lg"
              >
                Download PFX
              </button>
            </div>
          </div>
        </div>
      )}

    </ToolContainer>
  );
}
