import { describe, it, expect } from "vitest";
import { ipToNum, isPrivateIP, isPrivateHostname, isIPv4Literal, isPrivateIPv6, normalizeHost } from "@/lib/ssrf-utils";

describe("ssrf-utils", () => {
  describe("ipToNum", () => {
    it("converts 0.0.0.0 to 0", () => {
      expect(ipToNum("0.0.0.0")).toBe(0);
    });

    it("converts 127.0.0.1 to 2130706433", () => {
      expect(ipToNum("127.0.0.1")).toBe(2130706433);
    });

    it("converts 10.0.0.1 to 167772161", () => {
      expect(ipToNum("10.0.0.1")).toBe(167772161);
    });

    it("converts 192.168.1.1 to 3232235777", () => {
      expect(ipToNum("192.168.1.1")).toBe(3232235777);
    });

    it("converts 8.8.8.8 to 134744072", () => {
      expect(ipToNum("8.8.8.8")).toBe(134744072);
    });

    it("converts 255.255.255.255 to 4294967295", () => {
      expect(ipToNum("255.255.255.255")).toBe(4294967295);
    });
  });

  describe("isPrivateIP", () => {
    it("detects 10.x.x.x as private", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
      expect(isPrivateIP("10.1.2.3")).toBe(true);
    });

    it("detects 172.16-31.x.x as private", () => {
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
      expect(isPrivateIP("172.20.0.1")).toBe(true);
    });

    it("detects 192.168.x.x as private", () => {
      expect(isPrivateIP("192.168.0.1")).toBe(true);
      expect(isPrivateIP("192.168.255.255")).toBe(true);
    });

    it("detects 127.x.x.x (loopback) as private", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("127.255.0.1")).toBe(true);
    });

    it("detects 169.254.x.x (link-local) as private", () => {
      expect(isPrivateIP("169.254.0.1")).toBe(true);
      expect(isPrivateIP("169.254.254.1")).toBe(true);
    });

    it("detects 0.x.x.x as private", () => {
      expect(isPrivateIP("0.0.0.0")).toBe(true);
      expect(isPrivateIP("0.255.0.1")).toBe(true);
    });

    it("allows public IPs", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
      expect(isPrivateIP("142.250.80.46")).toBe(false);
    });

    it("detects new reserved IPv4 ranges", () => {
      expect(isPrivateIP("100.64.0.1")).toBe(true);
      expect(isPrivateIP("100.127.255.254")).toBe(true);
      expect(isPrivateIP("192.0.0.1")).toBe(true);
      expect(isPrivateIP("192.0.2.1")).toBe(true);
      expect(isPrivateIP("198.51.100.1")).toBe(true);
      expect(isPrivateIP("203.0.113.1")).toBe(true);
      expect(isPrivateIP("198.18.0.1")).toBe(true);
      expect(isPrivateIP("224.0.0.1")).toBe(true);
      expect(isPrivateIP("240.0.0.1")).toBe(true);
    });

    it("detects private IPv6 addresses", () => {
      expect(isPrivateIP("::1")).toBe(true);
      expect(isPrivateIP("::")).toBe(true);
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("fd00::1")).toBe(true);
      expect(isPrivateIP("ff00::1")).toBe(true);
    });

    it("allows public IPv6 addresses", () => {
      expect(isPrivateIP("2001:db8::1")).toBe(false);
      expect(isPrivateIP("2607:f8b0:4004:800::200e")).toBe(false);
    });

    it("allows public IPs", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
      expect(isPrivateIP("142.250.80.46")).toBe(false);
    });
  });

  describe("isPrivateIPv6", () => {
    it("detects loopback ::1", () => {
      expect(isPrivateIPv6("::1")).toBe(true);
    });

    it("detects unspecified ::", () => {
      expect(isPrivateIPv6("::")).toBe(true);
    });

    it("detects bracketed ::1", () => {
      expect(isPrivateIPv6("[::1]")).toBe(true);
    });

    it("detects link-local fe80::/10", () => {
      expect(isPrivateIPv6("fe80::1")).toBe(true);
      expect(isPrivateIPv6("fe80::ff:fe00:1")).toBe(true);
    });

    it("detects unique local fc00::/7", () => {
      expect(isPrivateIPv6("fc00::1")).toBe(true);
      expect(isPrivateIPv6("fd00::1")).toBe(true);
      expect(isPrivateIPv6("fd12:3456:7890::1")).toBe(true);
    });

    it("detects multicast ff00::/8", () => {
      expect(isPrivateIPv6("ff00::1")).toBe(true);
      expect(isPrivateIPv6("ff02::1")).toBe(true);
    });

    it("detects IPv4-mapped private addresses", () => {
      expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:10.0.0.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:192.168.1.1")).toBe(true);
    });

    it("allows IPv4-mapped public addresses", () => {
      expect(isPrivateIPv6("::ffff:8.8.8.8")).toBe(false);
    });

    it("allows public IPv6 addresses", () => {
      expect(isPrivateIPv6("2001:db8::1")).toBe(false);
      expect(isPrivateIPv6("2607:f8b0:4004:800::200e")).toBe(false);
    });
  });

  describe("normalizeHost", () => {
    it("lowercases hostnames", () => {
      expect(normalizeHost("Google.COM")).toBe("google.com");
    });

    it("trims whitespace", () => {
      expect(normalizeHost("  example.com  ")).toBe("example.com");
    });

    it("strips brackets from IPv6 literals", () => {
      expect(normalizeHost("[::1]")).toBe("::1");
      expect(normalizeHost("[fe80::1]")).toBe("fe80::1");
    });

    it("leaves IPv4 literals unchanged", () => {
      expect(normalizeHost("192.168.1.1")).toBe("192.168.1.1");
    });
  });

  describe("isPrivateHostname", () => {
    it("detects localhost", () => {
      expect(isPrivateHostname("localhost")).toBe(true);
    });

    it("detects 127.0.0.1", () => {
      expect(isPrivateHostname("127.0.0.1")).toBe(true);
    });

    it("detects 0.0.0.0", () => {
      expect(isPrivateHostname("0.0.0.0")).toBe(true);
    });

    it("detects ::1", () => {
      expect(isPrivateHostname("::1")).toBe(true);
    });

    it("detects cloud metadata hostnames", () => {
      expect(isPrivateHostname("metadata.google.internal")).toBe(true);
      expect(isPrivateHostname("metadata.azure.internal")).toBe(true);
    });

    it("detects IPv6 loopback hostnames", () => {
      expect(isPrivateHostname("[::1]")).toBe(true);
      expect(isPrivateHostname("ip6-localhost")).toBe(true);
      expect(isPrivateHostname("ip6-loopback")).toBe(true);
    });

    it("allows public hostnames", () => {
      expect(isPrivateHostname("google.com")).toBe(false);
      expect(isPrivateHostname("api.example.com")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isPrivateHostname("LOCALHOST")).toBe(true);
      expect(isPrivateHostname("LocalHost")).toBe(true);
    });
  });

  describe("isIPv4Literal", () => {
    it("detects valid IPv4 literals", () => {
      expect(isIPv4Literal("8.8.8.8")).toBe(true);
      expect(isIPv4Literal("192.168.1.1")).toBe(true);
      expect(isIPv4Literal("0.0.0.0")).toBe(true);
    });

    it("rejects hostnames", () => {
      expect(isIPv4Literal("google.com")).toBe(false);
      expect(isIPv4Literal("localhost")).toBe(false);
    });
  });
});
