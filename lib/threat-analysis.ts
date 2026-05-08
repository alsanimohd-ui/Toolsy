export interface ExtractedIOCs {
  ips: string[];
  domains: string[];
  urls: string[];
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

export function extractIOCs(text: string): ExtractedIOCs {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

  return {
    ips: Array.from(new Set(text.match(ipRegex) || [])),
    domains: Array.from(new Set(text.match(domainRegex) || [])).filter((domain) => !domain.includes(".dll") && !domain.includes(".exe")),
    urls: Array.from(new Set(text.match(urlRegex) || [])),
  };
}

export function extractPrintableStrings(text: string, limit = 20) {
  return text
    .split(/[\x00-\x1F\x7F-\xFF]/)
    .filter((value) => value.length > 8 && /^[A-Za-z0-9_.-]+$/.test(value))
    .slice(0, limit);
}
