import { describe, it, expect } from "vitest";
import { executeRegex } from "@/lib/regex-engine";

describe("regex-engine", () => {
  describe("executeRegex", () => {
    it("returns isValid true for a valid pattern", () => {
      const result = executeRegex("hello", "", "hello world");
      expect(result.isValid).toBe(true);
    });

    it("returns isValid false for an invalid pattern", () => {
      const result = executeRegex("[invalid", "", "test");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("finds a simple match", () => {
      const result = executeRegex("world", "", "hello world");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].match).toBe("world");
      expect(result.matches[0].index).toBe(6);
    });

    it("finds all matches with global flag", () => {
      const result = executeRegex("a", "g", "banana");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(3);
    });

    it("returns capturing groups", () => {
      const result = executeRegex("(\\w+)@(\\w+)", "", "user@host");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].groups).toEqual(["user", "host"]);
    });

    it("returns named capturing groups", () => {
      const result = executeRegex("(?<name>\\w+)", "", "hello");
      expect(result.isValid).toBe(true);
      expect(result.matches[0].namedGroups).toEqual({ name: "hello" });
    });

    it("performs string replacement", () => {
      const result = executeRegex("world", "", "hello world", "there");
      expect(result.replacedText).toBe("hello there");
    });

    it("returns explanation for start anchor", () => {
      const result = executeRegex("^hello", "", "hello");
      expect(result.explanation.some((e) => e.includes("Start"))).toBe(true);
    });

    it("returns explanation for end anchor", () => {
      const result = executeRegex("world$", "", "hello world");
      expect(result.explanation.some((e) => e.includes("End"))).toBe(true);
    });

    it("returns explanation for digit class", () => {
      const result = executeRegex("\\d+", "", "abc123");
      expect(result.explanation.some((e) => e.includes("digit"))).toBe(true);
    });

    it("handles complex patterns with multiple constructs", () => {
      const result = executeRegex("^(?<word>\\w+)@(?<domain>\\w+\\.\\w+)$", "", "user@example.com");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].namedGroups.word).toBe("user");
      expect(result.matches[0].namedGroups.domain).toBe("example.com");
      expect(result.explanation.some((e) => e.includes("Start"))).toBe(true);
      expect(result.explanation.some((e) => e.includes("End"))).toBe(true);
      expect(result.explanation.some((e) => e.includes("digit"))).toBe(false);
    });

    it("returns empty matches for no match", () => {
      const result = executeRegex("xyz", "", "hello");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(0);
    });

    it("safely handles patterns with quantifiers", () => {
      const result = executeRegex("a+", "", "aaaa");
      expect(result.isValid).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].match).toBe("aaaa");
    });

    it("provides execution time", () => {
      const result = executeRegex("a", "g", "aaaa");
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
