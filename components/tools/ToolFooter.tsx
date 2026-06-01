"use client";

import { useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Globe, 
  Info,
  type LucideIcon 
} from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import logoColor from "@/assets/logo/logo-color.png";
import logoWhite from "@/assets/logo/logo-white.png";

/* ─────────────────────────────────────────────
   Types & Interfaces
   ───────────────────────────────────────────── */

export interface FooterColumn {
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "success" | "danger" | "warning" | "info" | "default";
}

interface ToolFooterProps {
  title?: string;
  subtitle?: string;
  columns?: FooterColumn[];
}

/* ─────────────────────────────────────────────
   Contextual Tool Manual Database
   ───────────────────────────────────────────── */

interface StaticManual {
  title: string;
  subtitle: string;
  columns: FooterColumn[];
}

const TOOL_MANUALS: Record<string, StaticManual> = {
  "port-checker": {
    title: "Network Diagnostics Manual",
    subtitle: "Understanding Port Connectivity States",
    columns: [
      {
        title: "PORT OPEN",
        variant: "success",
        icon: CheckCircle2,
        description: "An application is actively accepting TCP connections, UDP datagrams, or SCTP associations on this port. This indicates the service is running, bound to the specified interface, and reachable without firewall interference."
      },
      {
        title: "PORT CLOSED",
        variant: "danger",
        icon: XCircle,
        description: "A closed port is accessible (it receives and responds to probe packets), but there is no application listening on it. The host is reachable, but the intended service is either down or not configured to listen on this specific port."
      },
      {
        title: "FILTERED / TIMEOUT",
        variant: "warning",
        icon: Shield,
        description: "The connection request was silently dropped by a firewall, filter, or network obstacle before reaching the target. Because no response was received (not even an ICMP error), it is impossible to determine if the port is actually open or closed."
      }
    ]
  },
  "pcap-analyzer": {
    title: "Packet Forensic Manual",
    subtitle: "Understanding Network Traffic Analysis",
    columns: [
      {
        title: "CONVERSATION TRIAGE",
        variant: "info",
        icon: Activity,
        description: "Analyze packet sequences to reconstruct TCP streams, UDP conversations, and application layer sessions. Crucial for detecting protocol anomalies and diagnosing connection latency."
      },
      {
        title: "IOC EXTRACTION",
        variant: "danger",
        icon: Shield,
        description: "Identify Indicators of Compromise such as suspicious IP destinations, unrecognized DNS queries, unencrypted cleartext credentials, or malicious payload signatures embedded in the streams."
      },
      {
        title: "ANOMALY DETECTION",
        variant: "warning",
        icon: AlertTriangle,
        description: "Flags out-of-order packets, duplicate ACKs, zero window advertisements, and unusual retransmissions which indicate packet loss, network congestion, or potential denial-of-service attempts."
      }
    ]
  },
  "threat-inspector": {
    title: "Security Reputation Manual",
    subtitle: "Assessing Malware and Threat Indicators",
    columns: [
      {
        title: "FILE INTEGRITY",
        variant: "success",
        icon: CheckCircle2,
        description: "Compute cryptographic hashes (MD5, SHA-1, SHA-256) of local files completely offline to verify they match original release signatures and have not been altered or tampered with."
      },
      {
        title: "REPUTATION SEARCH",
        variant: "danger",
        icon: Shield,
        description: "Queries VirusTotal and threat intelligence platforms to check if file hashes, IP addresses, or domains have been flagged as malicious by leading global security vendors."
      },
      {
        title: "SANDBOX TRIAGE",
        variant: "warning",
        icon: AlertTriangle,
        description: "Provides dynamic execution warnings and structural heuristics indicators (e.g. packed binaries, high entropy, suspicious APIs) to flag potentially zero-day threats before deployment."
      }
    ]
  },
  "ssl-toolkit": {
    title: "Cryptography & PKI Manual",
    subtitle: "Managing Certificates and Key Pairs",
    columns: [
      {
        title: "PEM/CRT DECODING",
        variant: "info",
        icon: Activity,
        description: "Parses PEM blocks to extract public key attributes, Issuer, Subject name, signature algorithms, and key size parameters completely offline for secure verification."
      },
      {
        title: "CHAIN VALIDATION",
        variant: "success",
        icon: CheckCircle2,
        description: "Verifies that the intermediate certificates properly link the end-entity certificate back to a trusted Root Certificate Authority (CA) to prevent trust warnings."
      },
      {
        title: "EXPIRATION AUDITING",
        variant: "warning",
        icon: Clock,
        description: "Flags certificates nearing their end-of-life dates and evaluates cryptographic algorithm strength to deprecate outdated suites like SHA-1 or MD5."
      }
    ]
  },
  "qr-generator": {
    title: "QR Code Standard Manual",
    subtitle: "Understanding Matrix Code Configurations",
    columns: [
      {
        title: "ERROR CORRECTION",
        variant: "success",
        icon: Shield,
        description: "Uses Reed-Solomon codes to allow scanner readability even if the QR code is dirty or partially damaged. Variants range from Low (7% recovery) to High (30% recovery)."
      },
      {
        title: "DATA CAPACITY",
        variant: "info",
        icon: Activity,
        description: "Configures density based on data type (Numeric, Alphanumeric, Byte, or Kanji). High capacity leads to dense, detailed module matrices requiring high-resolution scanners."
      },
      {
        title: "LOGO EMBEDDING",
        variant: "warning",
        icon: AlertTriangle,
        description: "Injects customized logos or branding icons into the center of the QR matrix. Requires setting the error correction level to High (H) to prevent scanning failures."
      }
    ]
  },
  "log-analyzer": {
    title: "Application Telemetry Manual",
    subtitle: "Parsing and Diagnosing Log Outputs",
    columns: [
      {
        title: "SEVERITY LEVELS",
        variant: "info",
        icon: Activity,
        description: "Classifies log messages from DEBUG and INFO (system status updates) to WARN, ERROR, and FATAL (immediate engineering attention required) to speed up diagnostic triage."
      },
      {
        title: "REGEX PATTERN FILTER",
        variant: "success",
        icon: CheckCircle2,
        description: "Extracts specific transactional events, user sessions, or error traces using complex text parsing rules to filter out high-volume boilerplate background noise."
      },
      {
        title: "IP & HOST ANALYSIS",
        variant: "warning",
        icon: Globe,
        description: "Identifies client origin IP addresses and server hostnames to trace geo-location requests, evaluate brute-force attempt frequencies, and track path routing paths."
      }
    ]
  },
  "paste-to-code": {
    title: "Data Transformation Manual",
    subtitle: "Formatting and Serializing Messy Tables",
    columns: [
      {
        title: "DELIMITER DETECTION",
        variant: "info",
        icon: Activity,
        description: "Dynamically scans unstructured raw strings to detect delimiter separators (such as tabs, commas, semicolons, or pipes) and parse tabular grid formats accurately."
      },
      {
        title: "SCHEMA INFERENCE",
        variant: "success",
        icon: CheckCircle2,
        description: "Analyzes column rows to dynamically infer data types (integer, float, boolean, string, date) and generate strongly typed model definitions or SQL schemas."
      },
      {
        title: "ENCODING CONVERSION",
        variant: "warning",
        icon: AlertTriangle,
        description: "Sanitizes special characters, handles escaping quotes, and converts character sets to ensure compatibility with JSON specifications and target languages."
      }
    ]
  },
  "regex-studio": {
    title: "Regular Expression Manual",
    subtitle: "Pattern Matching and Performance",
    columns: [
      {
        title: "ENGINE MATCHING",
        variant: "info",
        icon: Activity,
        description: "Evaluates pattern capture states using dynamic deterministic and non-deterministic finite automata (DFA/NFA) engines for real-time text parsing."
      },
      {
        title: "BACKTRACKING WARNINGS",
        variant: "danger",
        icon: AlertTriangle,
        description: "Identifies inefficient regex patterns (e.g. nested quantifiers like (a+)*) that trigger exponential search spaces and cause CPU exhaustion or browser freezing."
      },
      {
        title: "CAPTURE GROUPING",
        variant: "success",
        icon: CheckCircle2,
        description: "Organizes matching outputs into indexed or named capture subgroups, allowing developers to isolate and extract specific variables from complex bodies of text."
      }
    ]
  },
  "api-request-lab": {
    title: "HTTP Engineering Manual",
    subtitle: "Diagnosing RESTful and GraphQL Transactions",
    columns: [
      {
        title: "STATUS CODES",
        variant: "info",
        icon: Activity,
        description: "Categorizes HTTP responses: 2xx (Success), 3xx (Redirection), 4xx (Client error like unauthorized or not found), and 5xx (Server-side application crash)."
      },
      {
        title: "CORS HEURISTICS",
        variant: "warning",
        icon: Shield,
        description: "Diagnoses issues with Cross-Origin Resource Sharing (CORS) headers like Access-Control-Allow-Origin, indicating if a browser request is blocked by remote server policies."
      },
      {
        title: "HEADER OPTIMIZATION",
        variant: "success",
        icon: CheckCircle2,
        description: "Verifies Content-Type, Authorization tokens, and Cache-Control headers to ensure client requests comply with secure standards and cache rules."
      }
    ]
  },
  "running-config-decoder": {
    title: "Infrastructure Manual",
    subtitle: "Parsing Configuration Blocks & Topology Maps",
    columns: [
      {
        title: "STATE MATCHING",
        variant: "info",
        icon: Activity,
        description: "Scans raw text syntax to dynamically extract hostnames, firmware versions, active interfaces, routing parameters, and logical subnets without pre-defined templates."
      },
      {
        title: "INTERFACE MAPPING",
        variant: "success",
        icon: CheckCircle2,
        description: "Identifies physical ethernet ports, virtual interfaces, logical VLANs, and active tunnels to automatically map the system connectivity graph."
      },
      {
        title: "TOPOLOGY RESOLUTION",
        variant: "warning",
        icon: Shield,
        description: "Calculates deterministic canvas coordinates for peripheral nodes around the central Core Switch, locking layout coordinates permanently to ensure zero jitter."
      }
    ]
  },
  "core-encoder": {
    title: "Data Encoding Manual",
    subtitle: "Understanding Hashing & Encoding Architectures",
    columns: [
      {
        title: "ASYMMETRIC vs SYMMETRIC",
        variant: "info",
        icon: Activity,
        description: "Explores raw text transformations from reversible encoding (Base64, Hex, URL-encoding) to irreversible cryptographic digests (MD5, SHA-2, SHA-3)."
      },
      {
        title: "COLLISION RISK",
        variant: "danger",
        icon: AlertTriangle,
        description: "Warns against using legacy cryptographic hashing algorithms like MD5 or SHA-1 for password hashing or file signatures due to known mathematical collision vulnerabilities."
      },
      {
        title: "SANITIZATION HYGIENE",
        variant: "success",
        icon: CheckCircle2,
        description: "Applies secure decoding practices to handle null bytes, eliminate cross-site scripting (XSS) injection vectors, and prevent buffer overflows during data deserialization."
      }
    ]
  }
};

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */

export default function ToolFooter({ title, subtitle, columns }: ToolFooterProps) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);

  // 1. Resolve current active tool slug from the route path
  const currentSlug = useMemo(() => {
    if (!pathname) return "";
    const parts = pathname.split("/");
    return parts[parts.length - 1] || "";
  }, [pathname]);

  // 2. Load pre-configured manual content if custom props are not provided
  const resolvedManual = useMemo(() => {
    const manual = TOOL_MANUALS[currentSlug];
    return {
      title: title || manual?.title || "System Diagnostics Manual",
      subtitle: subtitle || manual?.subtitle || "Operational Guidelines and Structural States",
      columns: columns || manual?.columns || [
        {
          title: "SYSTEM LOGIC",
          variant: "info",
          icon: Activity,
          description: "Monitors execution states, parses operational data flows, and tracks peripheral component integrity on standard platform cycles."
        },
        {
          title: "SECURITY BOUNDARY",
          variant: "success",
          icon: Shield,
          description: "Enforces strict local-first, offline boundaries for cryptography, formatting engines, and reputation modules."
        },
        {
          title: "REDUNDANCY AUDITING",
          variant: "warning",
          icon: AlertTriangle,
          description: "Detects structural anomalies, bad syntax inputs, and network latency thresholds to ensure smooth developer workflows."
        }
      ]
    };
  }, [currentSlug, title, subtitle, columns]);

  // 3. Monitor active dark/light mode states
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const getVariantStyles = (variant?: string) => {
    switch (variant) {
      case "success":
        return {
          textColor: "text-emerald-400",
          cardStyle: "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30"
        };
      case "danger":
        return {
          textColor: "text-red-400",
          cardStyle: "bg-red-500/[0.02] border-red-500/10 hover:border-red-500/30"
        };
      case "warning":
        return {
          textColor: "text-amber-400",
          cardStyle: "bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/30"
        };
      case "info":
        return {
          textColor: "text-blue-400",
          cardStyle: "bg-blue-500/[0.02] border-blue-500/10 hover:border-blue-500/30"
        };
      default:
        return {
          textColor: "text-accent",
          cardStyle: "bg-accent/[0.02] border-white/5 hover:border-accent/30"
        };
    }
  };

  return (
    <section className="mt-16 pt-10 border-t border-white/5 flex flex-col gap-10">
      
      {/* Dynamic Header */}
      <div className="flex flex-col gap-2 text-center md:text-left">
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">
          {resolvedManual.title}
        </h3>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
          {resolvedManual.subtitle}
        </p>
      </div>

      {/* Dynamic 3-Column Descriptive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {resolvedManual.columns.map((col, idx) => {
          const styles = getVariantStyles(col.variant);
          const Icon = col.icon || Info;
          return (
            <GlassCard
              key={idx}
              className={`flex flex-col gap-5 p-6 transition-all duration-300 ${styles.cardStyle}`}
            >
              <div className={`flex items-center gap-3 ${styles.textColor}`}>
                <Icon className="size-5 shrink-0" />
                <h4 className="text-[11px] font-black uppercase tracking-wider">
                  {col.title}
                </h4>
              </div>
              <p className="text-[11px] font-medium text-muted/75 leading-relaxed">
                {col.description}
              </p>
            </GlassCard>
          );
        })}
      </div>

      {/* Maker-AI Premium Glassmorphic Corporate Branding Row */}
      <div className="mt-4 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] font-black uppercase tracking-[0.35em] text-muted/50 bg-white/[0.01] dark:bg-black/10 backdrop-blur-md px-8 py-5 rounded-[20px] border border-white/5">
        <span className="opacity-80">
          Engineered and Powered by maker-ai
        </span>
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isDark ? logoWhite.src : logoColor.src}
            alt="maker-ai logo"
            className="h-4 opacity-75 hover:opacity-100 transition-opacity duration-300 select-none pointer-events-none"
          />
        </div>
      </div>

    </section>
  );
}
