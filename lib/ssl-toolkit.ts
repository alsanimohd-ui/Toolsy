import forge from "node-forge";

/* ─────────────────────────────────────────────
   Types
  ───────────────────────────────────────────── */

export interface CertOverview {
  domain: string;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  status: "valid" | "warning" | "expired";
  notYetValid: boolean;
  sans: string[];
  sigAlg: string;
  keyType: string;
  keySize: number | string;
}

export type ChainStatus = "none" | "complete" | "incomplete" | "broken";
export type KeyMatch = "match" | "mismatch" | "encrypted" | "wrong-password" | "unsupported" | "invalid";

export interface PemCollection {
  keys: string[];
  certs: string[];
  csr: string | null;
}

export interface OrganizedCerts {
  leaf: string | null;
  /** Ordered from the leaf's issuer upwards. Unrelated certificates come last. */
  chain: string[];
  chainStatus: ChainStatus;
}

export type DecodedUpload =
  | { kind: "text"; text: string; displayType: string }
  | { kind: "pfx"; bytes: Uint8Array; displayType: string };

/* ─────────────────────────────────────────────
   Byte helpers
  ───────────────────────────────────────────── */

export const bytesToBinary = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
};

export const binaryToBytes = (binary: string): Uint8Array => {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

const normalizePem = (pem: string) => pem.replace(/\r\n?/g, "\n").trim();

/* ─────────────────────────────────────────────
   PEM parsing and classification
  ───────────────────────────────────────────── */

const PEM_BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g;

export const extractPemBlocks = (text: string): { label: string; pem: string }[] => {
  const out: { label: string; pem: string }[] = [];
  for (const m of Array.from(text.matchAll(PEM_BLOCK))) out.push({ label: m[1], pem: normalizePem(m[0]) });
  return out;
};

const certsFromPkcs7Pem = (pem: string): string[] => {
  try {
    const p7 = forge.pkcs7.messageFromPem(pem) as unknown as { certificates?: forge.pki.Certificate[] };
    return (p7.certificates || []).map(c => forge.pki.certificateToPem(c).trim());
  } catch {
    return [];
  }
};

export const classifyText = (name: string, text: string): string => {
  const blocks = extractPemBlocks(text);
  const labels = blocks.map(b => b.label);
  const hasKey = labels.some(l => l.endsWith("PRIVATE KEY"));
  const hasCsr = labels.some(l => l.includes("CERTIFICATE REQUEST"));
  const certCount = labels.filter(l => l === "CERTIFICATE").length;
  const hasP7 = labels.some(l => l === "PKCS7");

  if (hasKey && (certCount > 0 || hasP7)) return "Key & Certificate";
  if (hasKey) return "Private Key";
  if (hasCsr) return "CSR";
  if (hasP7) return "P7B Bundle";
  if (certCount > 1 || (certCount === 1 && /chain|bundle/i.test(name))) return "CA Chain";
  if (certCount === 1) return "Certificate";
  return "Unknown";
};

/** Collects keys, certificates (including those inside PKCS#7 blocks) and the CSR from text sources. */
export const collectPem = (texts: string[]): PemCollection => {
  const keys: string[] = [];
  const certs: string[] = [];
  let csr: string | null = null;
  const seen = new Set<string>();
  const addCert = (pem: string) => {
    const k = pem.replace(/\s+/g, "");
    if (seen.has(k)) return;
    seen.add(k);
    certs.push(pem);
  };

  for (const text of texts) {
    for (const { label, pem } of extractPemBlocks(text)) {
      if (label.endsWith("PRIVATE KEY")) {
        if (!keys.includes(pem)) keys.push(pem);
      } else if (label.includes("CERTIFICATE REQUEST")) {
        csr = pem;
      } else if (label === "CERTIFICATE") {
        addCert(pem);
      } else if (label === "PKCS7") {
        certsFromPkcs7Pem(pem).forEach(addCert);
      }
    }
  }
  return { keys, certs, csr };
};

/**
 * Decides how an uploaded file should be treated. PEM text is used as is, a binary P7B is
 * converted to PEM certificates, and anything else binary is treated as a PKCS#12 archive.
 */
export const decodeUpload = (name: string, bytes: Uint8Array): DecodedUpload => {
  const lower = name.toLowerCase();
  const looksPem = (() => {
    const head = bytesToBinary(bytes.subarray(0, 4096));
    return head.includes("-----BEGIN ");
  })();

  if (looksPem) {
    const text = new TextDecoder().decode(bytes);
    return { kind: "text", text, displayType: classifyText(name, text) };
  }

  if (lower.endsWith(".p7b") || lower.endsWith(".p7c")) {
    try {
      const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(bytesToBinary(bytes))) as unknown as { certificates?: forge.pki.Certificate[] };
      const pems = (p7.certificates || []).map(c => forge.pki.certificateToPem(c).trim());
      if (pems.length > 0) return { kind: "text", text: pems.join("\n"), displayType: "P7B Bundle" };
    } catch {
      /* fall through to unknown */
    }
    return { kind: "text", text: "", displayType: "Unknown" };
  }

  return { kind: "pfx", bytes, displayType: "PFX Archive" };
};

/* ─────────────────────────────────────────────
   Certificates
  ───────────────────────────────────────────── */

export const parseCert = (pem: string): forge.pki.Certificate | null => {
  try {
    return forge.pki.certificateFromPem(pem);
  } catch {
    return null;
  }
};

const attr = (attrs: forge.pki.CertificateField[], key: string) =>
  attrs.find(a => a.shortName === key || a.name === key)?.value as string | undefined;

export const getCertOverview = (pem: string, now: Date = new Date()): CertOverview | null => {
  const cert = parseCert(pem);
  if (!cert) return null;
  try {
    const domain = attr(cert.subject.attributes, "CN") || "Unknown Subject";
    const issuer = attr(cert.issuer.attributes, "CN") || "Unknown Issuer";
    const subject = cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(", ");

    const notAfter = cert.validity.notAfter;
    const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / 86_400_000);
    const status: CertOverview["status"] = daysLeft < 0 ? "expired" : daysLeft < 30 ? "warning" : "valid";
    const notYetValid = cert.validity.notBefore.getTime() > now.getTime();

    const ext = cert.getExtension("subjectAltName") as { altNames?: { value: string }[] } | null;
    const sans = ext?.altNames?.map(a => a.value) ?? [];
    const sigAlg = (forge.pki.oids as Record<string, string>)[cert.signatureOid] || cert.signatureOid;

    let keyType = "Unknown";
    let keySize: number | string = "Unknown";
    const pk = cert.publicKey as unknown as { n?: { bitLength(): number } } | undefined;
    if (pk?.n) {
      keyType = "RSA";
      keySize = pk.n.bitLength();
    }

    return {
      domain,
      issuer,
      subject,
      validFrom: cert.validity.notBefore.toLocaleDateString(),
      validTo: notAfter.toLocaleDateString(),
      daysLeft,
      status,
      notYetValid,
      sans,
      sigAlg,
      keyType,
      keySize,
    };
  } catch {
    return null;
  }
};

export const certFingerprint = (pem: string): string | null => {
  const cert = parseCert(pem);
  if (!cert) return null;
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const hex = forge.md.sha256.create().update(der).digest().toHex().toUpperCase();
  return hex.match(/.{1,2}/g)?.join(":") ?? null;
};

export const certSerial = (pem: string): string | null => parseCert(pem)?.serialNumber ?? null;

const isSelfSigned = (cert: forge.pki.Certificate) => cert.subject.hash === cert.issuer.hash;

const signedBy = (child: forge.pki.Certificate, issuer: forge.pki.Certificate): boolean => {
  try {
    return issuer.verify(child) === true;
  } catch {
    return false;
  }
};

/**
 * Picks the leaf and orders the rest of the certificates by following issuer links,
 * regardless of the order they were uploaded in.
 */
export const organizeCertificates = (pems: string[]): OrganizedCerts => {
  const parsed = pems
    .map(pem => ({ pem, cert: parseCert(pem) }))
    .filter((x): x is { pem: string; cert: forge.pki.Certificate } => x.cert !== null);

  if (parsed.length === 0) return { leaf: null, chain: [], chainStatus: "none" };

  const issuesOthers = (c: forge.pki.Certificate) =>
    parsed.some(o => o.cert !== c && o.cert.issuer.hash === c.subject.hash);

  const leafEntry =
    parsed.find(p => !issuesOthers(p.cert) && !isSelfSigned(p.cert)) ??
    parsed.find(p => !issuesOthers(p.cert)) ??
    parsed[0];

  const used = new Set([leafEntry]);
  const chain: string[] = [];
  let current = leafEntry;
  let verified = true;
  let reachedRoot = isSelfSigned(leafEntry.cert);

  while (!reachedRoot) {
    const next = parsed.find(p => !used.has(p) && p.cert.subject.hash === current.cert.issuer.hash);
    if (!next) break;
    if (!signedBy(current.cert, next.cert)) verified = false;
    used.add(next);
    chain.push(next.pem);
    current = next;
    reachedRoot = isSelfSigned(next.cert);
  }

  const leftovers = parsed.filter(p => !used.has(p));
  leftovers.forEach(p => chain.push(p.pem));

  let chainStatus: ChainStatus;
  if (chain.length === 0) chainStatus = "none";
  else if (!verified || leftovers.length > 0) chainStatus = "broken";
  else if (reachedRoot) chainStatus = "complete";
  else chainStatus = "incomplete";

  return { leaf: leafEntry.pem, chain, chainStatus };
};

/* ─────────────────────────────────────────────
   Private keys
  ───────────────────────────────────────────── */

export const isEncryptedKey = (pem: string) =>
  pem.includes("BEGIN ENCRYPTED PRIVATE KEY") || /Proc-Type:\s*4,ENCRYPTED/.test(pem);

const NON_RSA_KEY_OIDS = ["1.2.840.10045.2.1", "1.3.101.112", "1.3.101.113", "1.3.101.110", "1.3.101.111"];

const looksNonRsa = (pem: string): boolean => {
  if (pem.includes("BEGIN EC PRIVATE KEY")) return true;
  try {
    const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    const asn1 = forge.asn1.fromDer(forge.util.decode64(body));
    const algId = (asn1.value as forge.asn1.Asn1[])[1];
    const oid = forge.asn1.derToOid((algId.value as forge.asn1.Asn1[])[0].value as string);
    return NON_RSA_KEY_OIDS.includes(oid);
  } catch {
    return false;
  }
};

export type ParsedKey =
  | { status: "ok"; key: forge.pki.rsa.PrivateKey }
  | { status: "encrypted" | "wrong-password" | "unsupported" | "invalid" };

export const parsePrivateKey = (pem: string, password?: string): ParsedKey => {
  if (isEncryptedKey(pem)) {
    if (!password) return { status: "encrypted" };
    try {
      const key = forge.pki.decryptRsaPrivateKey(pem, password);
      return key ? { status: "ok", key } : { status: "wrong-password" };
    } catch {
      return { status: "wrong-password" };
    }
  }
  try {
    return { status: "ok", key: forge.pki.privateKeyFromPem(pem) as forge.pki.rsa.PrivateKey };
  } catch {
    return { status: looksNonRsa(pem) ? "unsupported" : "invalid" };
  }
};

/** Compares the key's public parameters with the certificate's, so no signing is involved. */
export const keyMatchesCert = (keyPem: string, certPem: string, password?: string): KeyMatch => {
  const parsed = parsePrivateKey(keyPem, password);
  if (parsed.status !== "ok") return parsed.status;
  const cert = parseCert(certPem);
  const pub = cert?.publicKey as unknown as forge.pki.rsa.PublicKey | undefined;
  if (!pub || !pub.n) return "unsupported";
  const key = parsed.key;
  return key.n.compareTo(pub.n) === 0 && key.e.compareTo(pub.e) === 0 ? "match" : "mismatch";
};

/* ─────────────────────────────────────────────
   Archives (PFX, P7B)
  ───────────────────────────────────────────── */

/** Throws when the password is wrong or the data is not a PKCS#12 archive. */
export const unlockPkcs12 = (bytes: Uint8Array, password: string): { keys: string[]; certs: string[] } => {
  const asn1 = forge.asn1.fromDer(bytesToBinary(bytes), false);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  const bagsOf = (type: string) => p12.getBags({ bagType: type })[type] || [];

  const keys = [...bagsOf(forge.pki.oids.pkcs8ShroudedKeyBag), ...bagsOf(forge.pki.oids.keyBag)]
    .filter(b => b.key)
    .map(b => forge.pki.privateKeyToPem(b.key as forge.pki.PrivateKey).trim());
  const certs = bagsOf(forge.pki.oids.certBag)
    .filter(b => b.cert)
    .map(b => forge.pki.certificateToPem(b.cert as forge.pki.Certificate).trim());
  return { keys, certs };
};

export const buildPfx = (keyPem: string, certPem: string, chain: string[], password: string, keyPassword?: string): Uint8Array | null => {
  try {
    const parsed = parsePrivateKey(keyPem, keyPassword);
    if (parsed.status !== "ok") return null;
    const certs = [certPem, ...chain].map(p => forge.pki.certificateFromPem(p));
    const asn1 = forge.pkcs12.toPkcs12Asn1(parsed.key, certs, password, { generateLocalKeyId: true, algorithm: "3des" });
    return binaryToBytes(forge.asn1.toDer(asn1).getBytes());
  } catch {
    return null;
  }
};

/** DER-encoded PKCS#7 certificate bundle (what Windows and Java expect from a .p7b). */
export const buildP7b = (certPem: string, chain: string[]): Uint8Array | null => {
  if (chain.length === 0) return null;
  try {
    const p7 = forge.pkcs7.createSignedData();
    [certPem, ...chain].forEach(p => p7.addCertificate(forge.pki.certificateFromPem(p)));
    return binaryToBytes(forge.asn1.toDer(p7.toAsn1()).getBytes());
  } catch {
    return null;
  }
};

/* ─────────────────────────────────────────────
   Misc
  ───────────────────────────────────────────── */

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";

/** Uses the Web Crypto RNG with rejection sampling to avoid modulo bias. */
export const generatePassword = (length = 16): string => {
  const limit = 256 - (256 % PASSWORD_CHARS.length);
  let out = "";
  while (out.length < length) {
    const buf = new Uint8Array(length * 2);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      if (buf[i] < limit) out += PASSWORD_CHARS[buf[i] % PASSWORD_CHARS.length];
    }
  }
  return out;
};

export const certBaseName = (overview: CertOverview | null): string => {
  if (overview?.domain && overview.domain !== "Unknown Subject") {
    return overview.domain.replace("*.", "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  return "ssl-output";
};
