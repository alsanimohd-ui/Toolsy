export interface ExtractedIOCs {
  ips: string[];
  domains: string[];
  urls: string[];
  emails: string[];
  hashes: string[];
  suspiciousCommands: string[];
}

export function calculateEntropy(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const freq: Record<number, number> = {};

  for (let i = 0; i < bytes.length; i++) {
    freq[bytes[i]] = (freq[bytes[i]] || 0) + 1;
  }

  let entropy = 0;
  for (const f in freq) {
    const p = freq[f] / bytes.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

export function detectMimeTypeFromMagic(buffer: ArrayBuffer): { mime: string, ext: string, desc: string } {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  // MZ header
  if (hex.startsWith('4D5A')) return { mime: 'application/x-msdownload', ext: 'exe/dll', desc: 'Windows PE Executable / DLL' };
  
  // ELF header
  if (hex.startsWith('7F454C46')) return { mime: 'application/x-elf', ext: 'elf', desc: 'Linux Executable (ELF)' };
  
  // PDF
  if (hex.startsWith('25504446')) return { mime: 'application/pdf', ext: 'pdf', desc: 'PDF Document' };
  
  // ZIP / DOCX / XLSX / APK
  if (hex.startsWith('504B0304')) return { mime: 'application/zip', ext: 'zip/docx/apk', desc: 'ZIP Archive / Office Open XML / APK' };
  
  // RAR
  if (hex.startsWith('52617221')) return { mime: 'application/x-rar-compressed', ext: 'rar', desc: 'RAR Archive' };
  
  // 7Z
  if (hex.startsWith('377ABCAF271C')) return { mime: 'application/x-7z-compressed', ext: '7z', desc: '7-Zip Archive' };
  
  // GZ
  if (hex.startsWith('1F8B')) return { mime: 'application/gzip', ext: 'gz', desc: 'GZIP Archive' };

  // MS Office legacy
  if (hex.startsWith('D0CF11E0A1B11AE1')) return { mime: 'application/vnd.ms-office', ext: 'doc/xls/ppt', desc: 'Legacy MS Office Document' };

  // RTF
  if (hex.startsWith('7B5C727466')) return { mime: 'application/rtf', ext: 'rtf', desc: 'Rich Text Format' };

  return { mime: 'application/octet-stream', ext: 'bin', desc: 'Unknown Binary Data' };
}

export function extractIOCs(text: string): ExtractedIOCs {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const md5Regex = /\b[a-fA-F0-9]{32}\b/g;
  const sha1Regex = /\b[a-fA-F0-9]{40}\b/g;
  const sha256Regex = /\b[a-fA-F0-9]{64}\b/g;

  // Extremely basic powershell / cmd usage
  const suspiciousRegex = /(powershell|cmd\.exe|wscript|cscript|certutil|bitsadmin|Invoke-Expression|IEX|Invoke-WebRequest|Net\.WebClient|base64|WScript\.Shell|CreateObject)/gi;

  const rawDomains = Array.from(new Set(text.match(domainRegex) || []));
  
  // Filter out extremely common false positives
  const falsePositives = ['www.w3.org', 'schemas.microsoft.com', 'schemas.openxmlformats.org', 'purl.org', 'xmlns.com'];
  const validDomains = rawDomains.filter(d => {
    const l = d.toLowerCase();
    return !l.endsWith(".dll") && !l.endsWith(".exe") && !falsePositives.includes(l);
  });

  const hashes = [
    ...(text.match(md5Regex) || []),
    ...(text.match(sha1Regex) || []),
    ...(text.match(sha256Regex) || [])
  ];

  return {
    ips: Array.from(new Set(text.match(ipRegex) || [])),
    domains: validDomains,
    urls: Array.from(new Set(text.match(urlRegex) || [])),
    emails: Array.from(new Set(text.match(emailRegex) || [])),
    hashes: Array.from(new Set(hashes)),
    suspiciousCommands: Array.from(new Set(text.match(suspiciousRegex) || [])).map(s => s.toLowerCase()),
  };
}

export function extractPrintableStrings(text: string, limit = 50) {
  return text
    .split(/[\x00-\x1F\x7F-\xFF]/)
    .map(s => s.trim())
    .filter((value) => value.length > 5 && /^[ -~]+$/.test(value))
    .slice(0, limit);
}
