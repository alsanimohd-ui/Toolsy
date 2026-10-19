import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isLocalTarget, parseClientPorts, scanPortLocally } from "@/lib/local-port-scanner";

describe("local-port-scanner", () => {
  describe("isLocalTarget", () => {
    it("detects loopback and private hosts", () => {
      for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.1", "[::1]", "nas.local"]) {
        expect(isLocalTarget(h)).toBe(true);
      }
    });

    it("treats public hosts as non-local", () => {
      for (const h of ["", "example.com", "8.8.8.8", "172.32.0.1"]) {
        expect(isLocalTarget(h)).toBe(false);
      }
    });
  });

  describe("parseClientPorts", () => {
    it("parses single port correctly", () => {
      expect(parseClientPorts("80")).toEqual([80]);
    });

    it("parses comma-separated ports correctly", () => {
      expect(parseClientPorts("80, 443, 8080")).toEqual([80, 443, 8080]);
    });

    it("parses port range correctly", () => {
      expect(parseClientPorts("8080-8083")).toEqual([8080, 8081, 8082, 8083]);
    });

    it("parses mix of single ports, ranges and spaces correctly", () => {
      expect(parseClientPorts("80, 443, 8080-8082")).toEqual([80, 443, 8080, 8081, 8082]);
    });

    it("filters out invalid ports", () => {
      expect(parseClientPorts("80, abc, 99999, -5")).toEqual([80]);
    });
  });

  describe("scanPortLocally", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("resolves as OPEN when fetch completes successfully", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { status: 200 };
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await scanPortLocally("localhost", 80, 1000);
      expect(result.status).toBe("OPEN");
      expect(result.port).toBe(80);
      expect(result.latency).toBeGreaterThanOrEqual(10);
    });

    it("resolves as CLOSED when fetch fails instantly (TypeError under 35ms)", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        throw new TypeError("Failed to fetch");
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await scanPortLocally("localhost", 80, 1000);
      expect(result.status).toBe("CLOSED");
      expect(result.latency).toBeLessThan(35);
    });

    it("resolves as OPEN when fetch fails slowly (TypeError >= 35ms)", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 40));
        throw new TypeError("Failed to fetch");
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await scanPortLocally("localhost", 80, 1000);
      expect(result.status).toBe("OPEN");
      expect(result.latency).toBeGreaterThanOrEqual(40);
    });

    it("uses the calibrated baseline to tell refused from non-HTTP services", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 40));
        throw new TypeError("Failed to fetch");
      }));

      const slowBaseline = await scanPortLocally("localhost", 5000, 1000, 40);
      expect(slowBaseline.status).toBe("CLOSED");
      const fastBaseline = await scanPortLocally("localhost", 5000, 1000, 2);
      expect(fastBaseline.status).toBe("OPEN");
    });

    it("reports browser-restricted ports as BLOCKED without fetching", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);
      const result = await scanPortLocally("localhost", 22, 1000);
      expect(result.status).toBe("BLOCKED");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("resolves as TIMEOUT when fetch is aborted", async () => {
      const mockFetch = vi.fn().mockImplementation(async (url, options) => {
        const signal = options?.signal;
        await new Promise((resolve, reject) => {
          const onAbort = () => {
            const err = new DOMException("The user aborted a request.", "AbortError");
            reject(err);
          };
          if (signal?.aborted) return onAbort();
          signal?.addEventListener("abort", onAbort);
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await scanPortLocally("localhost", 80, 50);
      expect(result.status).toBe("TIMEOUT");
    });
  });
});
