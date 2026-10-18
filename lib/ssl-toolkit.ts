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
  csrs: string[];
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

/** Collects keys, certificates (including those inside PKCS#7 blocks) and CSRs from text sources. */
export const collectPem = (texts: string[]): PemCollection => {
  const keys: string[] = [];
  const certs: string[] = [];
  const csrs: string[] = [];
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
        if (!csrs.includes(pem)) csrs.push(pem);
      } else if (label === "CERTIFICATE") {
        addCert(pem);
      } else if (label === "PKCS7") {
        certsFromPkcs7Pem(pem).forEach(addCert);
      }
    }
  }
  return { keys, certs, csrs };
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

  // A binary .cer/.der file holds a single DER certificate.
  try {
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(bytesToBinary(bytes)));
    const text = forge.pki.certificateToPem(cert);
    return { kind: "text", text, displayType: "Certificate" };
  } catch {
    /* not a certificate */
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

const isCaCert = (cert: forge.pki.Certificate) => {
  const bc = cert.getExtension("basicConstraints") as { cA?: boolean } | null;
  return bc?.cA === true;
};

const signedBy = (child: forge.pki.Certificate, issuer: forge.pki.Certificate): boolean => {
  try {
    return issuer.verify(child) === true;
  } catch {
    return false;
  }
};

interface ParsedCert {
  pem: string;
  cert: forge.pki.Certificate;
}

/** Follows issuer links upwards from a leaf. Intermediates may be shared between leaves. */
const walkChain = (leaf: ParsedCert, all: ParsedCert[]): { chain: string[]; chainStatus: ChainStatus; used: ParsedCert[] } => {
  const used: ParsedCert[] = [];
  let current = leaf;
  let verified = true;
  let reachedRoot = isSelfSigned(leaf.cert);

  while (!reachedRoot) {
    const candidates = all.filter(p => p !== current && !used.includes(p) && p !== leaf && p.cert.subject.hash === current.cert.issuer.hash);
    const next = candidates.find(p => signedBy(current.cert, p.cert)) ?? candidates[0];
    if (!next) break;
    if (!signedBy(current.cert, next.cert)) verified = false;
    used.push(next);
    current = next;
    reachedRoot = isSelfSigned(next.cert);
  }

  let chainStatus: ChainStatus;
  // A lone self-signed certificate has no chain to report; a lone non-root leaf is missing its issuer.
  if (used.length === 0) chainStatus = reachedRoot ? "none" : "incomplete";
  else if (!verified) chainStatus = "broken";
  else chainStatus = reachedRoot ? "complete" : "incomplete";
  return { chain: used.map(u => u.pem), chainStatus, used };
};

export interface RawCertSet {
  leaf: string;
  /** Ordered from the leaf's issuer upwards. */
  chain: string[];
  chainStatus: ChainStatus;
}

/**
 * Splits a pool of certificates into one set per end-entity certificate, ordering each
 * chain by issuer links (not upload order). CA certificates that belong to no chain are returned apart.
 */
export const buildCertSets = (pems: string[]): { sets: RawCertSet[]; strayCas: string[] } => {
  const parsed: ParsedCert[] = [];
  const seen = new Set<string>();
  for (const pem of pems) {
    const cert = parseCert(pem);
    const key = pem.replace(/\s+/g, "");
    if (!cert || seen.has(key)) continue;
    seen.add(key);
    parsed.push({ pem, cert });
  }

  const issuesOthers = (c: ParsedCert) =>
    parsed.some(o => o !== c && !isSelfSigned(o.cert) && o.cert.issuer.hash === c.cert.subject.hash);

  const leaves = parsed.filter(p => !issuesOthers(p) && !isCaCert(p.cert));
  const inChain = new Set<ParsedCert>();
  const sets = leaves.map(l => {
    const walked = walkChain(l, parsed);
    walked.used.forEach(u => inChain.add(u));
    return { leaf: l.pem, chain: walked.chain, chainStatus: walked.chainStatus };
  });

  const strayCas = parsed.filter(p => !leaves.includes(p) && !inChain.has(p)).map(p => p.pem);
  return { sets, strayCas };
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

/** The key as unencrypted PEM, or null when it cannot be read with the given password. */
export const unencryptedKeyPem = (pem: string, password?: string): string | null => {
  const parsed = parsePrivateKey(pem, password);
  return parsed.status === "ok" ? forge.pki.privateKeyToPem(parsed.key).replace(/\r\n?/g, "\n").trim() : null;
};

export const certToDer = (pem: string): Uint8Array | null => {
  const cert = parseCert(pem);
  return cert ? binaryToBytes(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()) : null;
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

/* ─────────────────────────────────────────────
   Inventory: many certificates, keys and CSRs at once
  ───────────────────────────────────────────── */

export interface CertSet extends RawCertSet {
  key: string | null;
  keyPassword?: string;
  csr: string | null;
}

export type StrayKeyState = "no-certificate" | "encrypted" | "wrong-password" | "unsupported" | "invalid";

export interface Inventory {
  sets: CertSet[];
  strayCas: string[];
  strayKeys: { pem: string; state: StrayKeyState }[];
  strayCsrs: string[];
}

type ResolvedKey =
  | { pem: string; status: "ok"; key: forge.pki.rsa.PrivateKey; password?: string }
  | { pem: string; status: "encrypted" | "wrong-password" | "unsupported" | "invalid" };

const resolveKey = (pem: string, passwords: string[]): ResolvedKey => {
  if (!isEncryptedKey(pem)) {
    const r = parsePrivateKey(pem);
    return r.status === "ok" ? { pem, status: "ok", key: r.key } : { pem, status: r.status };
  }
  if (passwords.length === 0) return { pem, status: "encrypted" };
  for (const password of passwords) {
    const r = parsePrivateKey(pem, password);
    if (r.status === "ok") return { pem, status: "ok", key: r.key, password };
  }
  return { pem, status: "wrong-password" };
};

const rsaPublic = (pem: string) => {
  const pub = parseCert(pem)?.publicKey as unknown as forge.pki.rsa.PublicKey | undefined;
  return pub?.n ? pub : null;
};

const csrPublic = (pem: string) => {
  try {
    const pub = forge.pki.certificationRequestFromPem(pem).publicKey as unknown as forge.pki.rsa.PublicKey | undefined;
    return pub?.n ? pub : null;
  } catch {
    return null;
  }
};

const samePublicKey = (a: forge.pki.rsa.PublicKey, b: forge.pki.rsa.PublicKey) =>
  a.n.compareTo(b.n) === 0 && a.e.compareTo(b.e) === 0;

/**
 * Groups everything the user uploaded by certificate: each end-entity certificate gets its ordered chain,
 * the private key that matches it and its CSR. Whatever does not belong to a certificate is reported apart.
 * `passwords` are tried on every encrypted key.
 */
export const buildInventory = (input: { certs: string[]; keys: string[]; csrs: string[] }, passwords: string[] = []): Inventory => {
  const { sets: raw, strayCas } = buildCertSets(input.certs);
  const resolved = input.keys.map(k => resolveKey(k, passwords));
  const keyUsed = new Set<number>();
  const csrUsed = new Set<number>();

  const sets: CertSet[] = raw.map(s => {
    const pub = rsaPublic(s.leaf);
    let key: string | null = null;
    let keyPassword: string | undefined;
    let csr: string | null = null;
    if (pub) {
      resolved.forEach((r, i) => {
        if (key === null && r.status === "ok" && samePublicKey(r.key as unknown as forge.pki.rsa.PublicKey, pub)) {
          key = r.pem;
          keyPassword = r.password;
        }
        if (r.status === "ok" && key === r.pem) keyUsed.add(i);
      });
      input.csrs.forEach((c, i) => {
        const cp = csrPublic(c);
        if (csr === null && cp && samePublicKey(cp, pub)) {
          csr = c;
          csrUsed.add(i);
        }
      });
    }
    return { ...s, key, keyPassword, csr };
  });

  const strayKeys = resolved
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => !keyUsed.has(i))
    .map(({ r }) => ({ pem: r.pem, state: (r.status === "ok" ? "no-certificate" : r.status) as StrayKeyState }));
  const strayCsrs = input.csrs.filter((_, i) => !csrUsed.has(i));

  const days = (s: CertSet) => getCertOverview(s.leaf)?.daysLeft ?? Number.POSITIVE_INFINITY;
  sets.sort((a, b) => days(a) - days(b));
  return { sets, strayCas, strayKeys, strayCsrs };
};

/* ─────────────────────────────────────────────
   Per-certificate package
  ───────────────────────────────────────────── */

export interface PackageFile {
  name: string;
  content: string | Uint8Array;
  description: string;
}

export interface SetPackage {
  files: PackageFile[];
  readme: string;
  hasPfx: boolean;
}

export const setBaseName = (set: CertSet) => certBaseName(getCertOverview(set.leaf));

/** Everything a user is likely to need for one certificate, named consistently. */
export const buildSetPackage = (set: CertSet, pfxPassword: string, generatedAt: Date = new Date()): SetPackage => {
  const overview = getCertOverview(set.leaf);
  const base = certBaseName(overview);
  const names = {
    cert: `CERTIFICATE_${base}.crt`,
    der: `CERTIFICATE_${base}.der.cer`,
    key: `PRIVATE-KEY_${base}.key`,
    chain: `CA-CHAIN_${base}.pem`,
    fullchain: `FULLCHAIN_${base}.pem`,
    bundle: `FULLCHAIN+KEY_${base}.pem`,
    pfx: `PFX_${base}.pfx`,
    p7b: `P7B_${base}.p7b`,
    csr: `CSR_${base}.csr`,
  };

  // A key is only attached to a set once it has been decrypted and matched, so it can always be written unencrypted.
  const plainKey = set.key ? unencryptedKeyPem(set.key, set.keyPassword) : null;
  const keyMatches = plainKey !== null;
  const keyName = names.key;
  const fullchain = [set.leaf, ...set.chain].join("\n") + "\n";
  const pfx = set.key && plainKey ? buildPfx(set.key, set.leaf, set.chain, pfxPassword, set.keyPassword) : null;
  const p7b = buildP7b(set.leaf, set.chain);
  const der = certToDer(set.leaf);

  const files: PackageFile[] = [];
  const add = (name: string, content: string | Uint8Array | null, description: string) => {
    if (content !== null) files.push({ name, content, description });
  };
  add(names.cert, set.leaf + "\n", "Certificate (PEM). Apache SSLCertificateFile.");
  add(names.der, der, "Certificate (DER binary). Windows and some appliances.");
  if (plainKey) add(keyName, plainKey + "\n", "Private key (PEM, unencrypted).");
  if (set.chain.length > 0) {
    add(names.chain, set.chain.join("\n\n") + "\n", "CA chain (PEM), leaf excluded. Apache SSLCertificateChainFile.");
    add(names.fullchain, fullchain, "Certificate + chain in one file. Nginx ssl_certificate.");
  }
  if (plainKey) add(names.bundle, `${fullchain}${plainKey}\n`, "Certificate + chain + key in one file. HAProxy and similar.");
  if (pfx) {
    add(names.pfx, pfx, "PKCS#12 archive for IIS, Windows and Azure. Password in PFX-PASSWORD.txt.");
    add("PFX-PASSWORD.txt", `${pfxPassword}\n`, "Password for the PFX file.");
  }
  add(names.p7b, p7b, "PKCS#7 bundle (DER) for Java and Windows imports.");
  if (set.csr) add(names.csr, set.csr + "\n", "Certificate signing request.");

  const chainLabel = {
    none: "none provided",
    complete: "complete",
    incomplete: "incomplete (an issuer is missing)",
    broken: "broken (bad signature)",
  }[set.chainStatus];

  const readme = [
    "SSL PACKAGE",
    `Generated by Mi (mi.maker-ai.tech) on ${generatedAt.toISOString().replace("T", " ").substring(0, 19)} UTC`,
    "",
    "CERTIFICATE",
    `Common Name (CN):     ${overview?.domain || "N/A"}`,
    `Subject Alt Names:    ${overview?.sans.join(", ") || "None"}`,
    `Issuer:               ${overview?.issuer || "N/A"}`,
    `Serial Number:        ${certSerial(set.leaf) ?? "N/A"}`,
    `SHA-256 Fingerprint:  ${certFingerprint(set.leaf) ?? "N/A"}`,
    `Key:                  ${overview ? `${overview.keyType} ${overview.keySize} bit` : "N/A"}`,
    `Signature Algorithm:  ${overview?.sigAlg || "N/A"}`,
    `Valid from:           ${overview?.validFrom || "N/A"}`,
    `Expires:              ${overview?.validTo || "N/A"}`,
    `Days remaining:       ${overview ? overview.daysLeft : "N/A"}`,
    "",
    "CHECKS",
    `Private key found and matches certificate: ${keyMatches ? "yes" : "NO KEY FOUND for this certificate"}`,
    `Chain: ${chainLabel}`,
    "",
    "FILES IN THIS FOLDER",
    ...files.filter(f => f.name !== "PFX-PASSWORD.txt").map(f => `${f.name.padEnd(42)} ${f.description}`),
    ...(pfx ? [`${"PFX-PASSWORD.txt".padEnd(42)} Password for the PFX file.`] : []),
    "",
    "DEPLOYMENT",
    `Nginx:   ssl_certificate ${names.fullchain}; ssl_certificate_key ${keyName};`,
    `Apache:  SSLCertificateFile ${names.cert}, SSLCertificateKeyFile ${keyName}, SSLCertificateChainFile ${names.chain}`,
    `HAProxy: bind :443 ssl crt ${names.bundle}`,
    "IIS:     Server Certificates > Import, choose the .pfx and enter the password from PFX-PASSWORD.txt.",
    "",
    "This folder contains your private key. Keep it private.",
    "Processed locally in your browser. No data was transmitted.",
  ].join("\n");

  return { files, readme, hasPfx: pfx !== null };
};
