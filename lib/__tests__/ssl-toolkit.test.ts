import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";
import {
  extractPemBlocks,
  classifyText,
  collectPem,
  decodeUpload,
  organizeCertificates,
  keyMatchesCert,
  parsePrivateKey,
  getCertOverview,
  buildPfx,
  unlockPkcs12,
  buildP7b,
  generatePassword,
  certBaseName,
  certFingerprint,
  certToDer,
  unencryptedKeyPem,
} from "../ssl-toolkit";

type Pair = forge.pki.rsa.KeyPair;

interface Made {
  pem: string;
  keyPem: string;
  keys: Pair;
  cert: forge.pki.Certificate;
}

const DAY = 86_400_000;

function make(cn: string, opts: { issuer?: Made; days?: number; startDays?: number } = {}): Made {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + Math.floor(Math.random() * 1e6).toString(16);
  cert.validity.notBefore = new Date(Date.now() + (opts.startDays ?? -1) * DAY);
  cert.validity.notAfter = new Date(Date.now() + (opts.days ?? 365) * DAY);
  const subject = [{ name: "commonName", value: cn }];
  cert.setSubject(subject);
  cert.setIssuer(opts.issuer ? opts.issuer.cert.subject.attributes : subject);
  cert.setExtensions([{ name: "subjectAltName", altNames: [{ type: 2, value: cn }] }]);
  cert.sign(opts.issuer ? opts.issuer.keys.privateKey : keys.privateKey, forge.md.sha256.create());
  return {
    pem: forge.pki.certificateToPem(cert).trim(),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey).trim(),
    keys,
    cert,
  };
}

let root: Made;
let inter: Made;
let leaf: Made;
let other: Made;

beforeAll(() => {
  root = make("Test Root CA");
  inter = make("Test Intermediate CA", { issuer: root });
  leaf = make("demo.example.com", { issuer: inter });
  other = make("other.example.com");
}, 60_000);

describe("PEM parsing", () => {
  it("finds blocks even when bag attributes contain hyphens", () => {
    const text = `Bag Attributes\n    friendlyName: my-cert\n${leaf.pem}\n\n${leaf.keyPem}\n`;
    const blocks = extractPemBlocks(text);
    expect(blocks.map(b => b.label)).toEqual(["CERTIFICATE", "RSA PRIVATE KEY"]);
  });

  it("normalises CRLF line endings", () => {
    const blocks = extractPemBlocks(leaf.pem.replace(/\r?\n/g, "\r\n"));
    expect(blocks[0].pem).not.toContain("\r");
    expect(parseOk(blocks[0].pem)).toBe(true);
  });

  it("classifies files", () => {
    expect(classifyText("a.crt", leaf.pem)).toBe("Certificate");
    expect(classifyText("a.key", leaf.keyPem)).toBe("Private Key");
    expect(classifyText("a.pem", `${leaf.pem}\n${leaf.keyPem}`)).toBe("Key & Certificate");
    expect(classifyText("a.pem", `${inter.pem}\n${root.pem}`)).toBe("CA Chain");
    expect(classifyText("fullchain.pem", inter.pem)).toBe("CA Chain");
    expect(classifyText("a.txt", "hello")).toBe("Unknown");
    expect(classifyText("a.csr", "-----BEGIN CERTIFICATE REQUEST-----\nAAAA\n-----END CERTIFICATE REQUEST-----")).toBe("CSR");
  });

  it("collects unique certs, keys and the CSR across sources", () => {
    const csr = "-----BEGIN CERTIFICATE REQUEST-----\nAAAA\n-----END CERTIFICATE REQUEST-----";
    const out = collectPem([`${leaf.pem}\n${leaf.keyPem}`, `${leaf.pem}\n${inter.pem}`, csr]);
    expect(out.certs).toHaveLength(2);
    expect(out.keys).toHaveLength(1);
    expect(out.csr).toContain("CERTIFICATE REQUEST");
  });

  it("expands PEM PKCS#7 bundles into certificates", () => {
    const p7 = forge.pkcs7.createSignedData();
    p7.addCertificate(leaf.cert);
    p7.addCertificate(inter.cert);
    const out = collectPem([forge.pkcs7.messageToPem(p7)]);
    expect(out.certs).toHaveLength(2);
  });
});

describe("uploads", () => {
  it("treats PEM content as text whatever the extension", () => {
    const bytes = new TextEncoder().encode(`${leaf.pem}\n${inter.pem}`);
    const out = decodeUpload("bundle.p7b", bytes);
    expect(out.kind).toBe("text");
    if (out.kind === "text") expect(out.displayType).toBe("CA Chain");
  });

  it("reads a binary P7B instead of asking for a PFX password", () => {
    const der = buildP7b(leaf.pem, [inter.pem])!;
    const out = decodeUpload("chain.p7b", der);
    expect(out.kind).toBe("text");
    if (out.kind === "text") {
      expect(out.displayType).toBe("P7B Bundle");
      expect(collectPem([out.text]).certs).toHaveLength(2);
    }
  });

  it("treats other binary files as PFX archives", () => {
    const out = decodeUpload("cert.pfx", new Uint8Array([0x30, 0x82, 0x01, 0x00]));
    expect(out.kind).toBe("pfx");
  });
});

describe("organizeCertificates", () => {
  it("finds the leaf and orders the chain regardless of upload order", () => {
    const out = organizeCertificates([root.pem, leaf.pem, inter.pem]);
    expect(out.leaf).toBe(leaf.pem);
    expect(out.chain).toEqual([inter.pem, root.pem]);
    expect(out.chainStatus).toBe("complete");
  });

  it("does not take a CA uploaded first for the leaf", () => {
    const out = organizeCertificates([inter.pem, leaf.pem]);
    expect(out.leaf).toBe(leaf.pem);
  });

  it("reports an incomplete chain when the root is missing", () => {
    const out = organizeCertificates([leaf.pem, inter.pem]);
    expect(out.chain).toEqual([inter.pem]);
    expect(out.chainStatus).toBe("incomplete");
  });

  it("flags unrelated certificates as a broken chain", () => {
    const out = organizeCertificates([leaf.pem, inter.pem, root.pem, other.pem]);
    expect(out.leaf).toBe(leaf.pem);
    expect(out.chain.at(-1)).toBe(other.pem);
    expect(out.chainStatus).toBe("broken");
  });

  it("flags a bad signature as broken", () => {
    const fakeInter = make("Test Intermediate CA", { issuer: other });
    const out = organizeCertificates([leaf.pem, fakeInter.pem]);
    expect(out.chainStatus).toBe("broken");
  });

  it("handles a single self-signed certificate and empty input", () => {
    expect(organizeCertificates([root.pem])).toEqual({ leaf: root.pem, chain: [], chainStatus: "none" });
    expect(organizeCertificates([])).toEqual({ leaf: null, chain: [], chainStatus: "none" });
  });
});

describe("keyMatchesCert", () => {
  it("matches a key with its certificate and rejects another", () => {
    expect(keyMatchesCert(leaf.keyPem, leaf.pem)).toBe("match");
    expect(keyMatchesCert(other.keyPem, leaf.pem)).toBe("mismatch");
  });

  it("asks for a password on encrypted keys and accepts the right one", () => {
    const enc = forge.pki.encryptRsaPrivateKey(leaf.keys.privateKey, "s3cret");
    expect(keyMatchesCert(enc, leaf.pem)).toBe("encrypted");
    expect(keyMatchesCert(enc, leaf.pem, "nope")).toBe("wrong-password");
    expect(keyMatchesCert(enc, leaf.pem, "s3cret")).toBe("match");
  });

  it("supports PKCS#8 encrypted keys", () => {
    const info = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(leaf.keys.privateKey));
    const enc = forge.pki.encryptedPrivateKeyToPem(forge.pki.encryptPrivateKeyInfo(info, "pw", { algorithm: "aes256" }));
    expect(parsePrivateKey(enc).status).toBe("encrypted");
    expect(keyMatchesCert(enc, leaf.pem, "pw")).toBe("match");
  });

  it("reports EC keys as unsupported instead of a mismatch", () => {
    const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "sec1", format: "pem" }) as string;
    expect(keyMatchesCert(ec, leaf.pem)).toBe("unsupported");
    const pkcs8 = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    expect(keyMatchesCert(pkcs8, leaf.pem)).toBe("unsupported");
  });

  it("reports garbage as invalid", () => {
    expect(keyMatchesCert("-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----", leaf.pem)).toBe("invalid");
  });
});

describe("getCertOverview", () => {
  it("reports expiry relative to a given date", () => {
    const now = new Date(leaf.cert.validity.notAfter.getTime() - 10 * DAY);
    const o = getCertOverview(leaf.pem, now)!;
    expect(o.domain).toBe("demo.example.com");
    expect(o.issuer).toBe("Test Intermediate CA");
    expect(o.daysLeft).toBe(10);
    expect(o.status).toBe("warning");
    expect(o.sans).toEqual(["demo.example.com"]);
    expect(o.keyType).toBe("RSA");
    expect(o.keySize).toBe(1024);
    expect(o.notYetValid).toBe(false);
  });

  it("flags expired and not-yet-valid certificates", () => {
    const expired = make("old.example.com", { days: -5, startDays: -30 });
    expect(getCertOverview(expired.pem)!.status).toBe("expired");
    const future = make("soon.example.com", { startDays: 10 });
    expect(getCertOverview(future.pem)!.notYetValid).toBe(true);
  });

  it("returns null for garbage", () => {
    expect(getCertOverview("nope")).toBeNull();
  });

  it("builds a safe base name and a fingerprint", () => {
    expect(certBaseName(getCertOverview(leaf.pem))).toBe("demo.example.com");
    expect(certBaseName(null)).toBe("ssl-output");
    expect(certFingerprint(leaf.pem)).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});

describe("archives", () => {
  it("round-trips a PFX and rejects a wrong password", () => {
    const pfx = buildPfx(leaf.keyPem, leaf.pem, [inter.pem, root.pem], "pw123")!;
    expect(pfx).toBeInstanceOf(Uint8Array);
    const out = unlockPkcs12(pfx, "pw123");
    expect(out.keys).toHaveLength(1);
    expect(out.certs).toHaveLength(3);
    expect(keyMatchesCert(out.keys[0], leaf.pem)).toBe("match");
    expect(() => unlockPkcs12(pfx, "wrong")).toThrow();
  });

  it("builds a PFX from an encrypted key only with its password", () => {
    const enc = forge.pki.encryptRsaPrivateKey(leaf.keys.privateKey, "kp");
    expect(buildPfx(enc, leaf.pem, [], "pw")).toBeNull();
    expect(buildPfx(enc, leaf.pem, [], "pw", "kp")).toBeInstanceOf(Uint8Array);
  });

  it("builds a DER P7B and needs a chain", () => {
    expect(buildP7b(leaf.pem, [])).toBeNull();
    const der = buildP7b(leaf.pem, [inter.pem, root.pem])!;
    expect(der[0]).toBe(0x30);
    const out = decodeUpload("x.p7b", der);
    expect(out.kind === "text" && collectPem([out.text]).certs).toHaveLength(3);
  });
});

describe("package helpers", () => {
  it("decrypts a key to plain PEM that still matches", () => {
    const enc = forge.pki.encryptRsaPrivateKey(leaf.keys.privateKey, "kp");
    expect(unencryptedKeyPem(enc)).toBeNull();
    expect(unencryptedKeyPem(enc, "bad")).toBeNull();
    const plain = unencryptedKeyPem(enc, "kp")!;
    expect(plain).not.toContain("ENCRYPTED");
    expect(plain).not.toContain("\r");
    expect(keyMatchesCert(plain, leaf.pem)).toBe("match");
  });

  it("converts a certificate to DER that parses back", () => {
    const der = certToDer(leaf.pem)!;
    expect(der[0]).toBe(0x30);
    const back = forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(der)));
    expect(back.subject.getField("CN").value).toBe("demo.example.com");
    expect(certToDer("nope")).toBeNull();
  });
});

describe("generatePassword", () => {
  it("returns the requested length from the allowed alphabet", () => {
    const p = generatePassword(24);
    expect(p).toHaveLength(24);
    expect(p).toMatch(/^[A-Za-z0-9!@#$%^&*\-_=+]+$/);
  });

  it("does not repeat", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

function parseOk(pem: string) {
  try {
    forge.pki.certificateFromPem(pem);
    return true;
  } catch {
    return false;
  }
}
