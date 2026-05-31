import { describe, it, expect } from "vitest";
import { ipToNum, isPrivateIP, isPrivateHostname, isIPv4Literal } from "@/lib/ssrf-utils";

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

    it("skips IPv6 addresses", () => {
      expect(isPrivateIP("::1")).toBe(false);
      expect(isPrivateIP("2001:db8::1")).toBe(false);
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
