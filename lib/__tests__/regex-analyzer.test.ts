import { describe, it, expect } from "vitest";
import { explainPattern } from "@/lib/regex-analyzer";

describe("regex-analyzer", () => {
  describe("explainPattern", () => {
    it("handles empty pattern fallback", () => {
      expect(explainPattern("")).toEqual(["Matches any string."]);
    });

    it("identifies start and end anchors", () => {
      const res = explainPattern("^abc$");
      expect(res).toContain("Start of the line/string.");
      expect(res).toContain("End of the line/string.");
    });

    it("identifies character classes", () => {
      const res = explainPattern("\\d\\w\\s\\b");
      expect(res).toContain("Matches a digit.");
      expect(res).toContain("Matches a word character (alphanumeric).");
      expect(res).toContain("Matches a whitespace character.");
      expect(res).toContain("Matches a word boundary.");
    });

    it("identifies quantifiers", () => {
      const res = explainPattern("a+b*c?");
      expect(res).toContain("Quantifier: Matches 1 or more times.");
      expect(res).toContain("Quantifier: Matches 0 or more times.");
      expect(res).toContain("Quantifier: Matches 0 or 1 time (or makes lazy).");
    });

    it("identifies bracket character classes and groups", () => {
      const res = explainPattern("[a-z](capture)(?<named>group)");
      expect(res).toContain("Character class: Matches one of the characters inside.");
      expect(res).toContain("Capturing group: Groups multiple tokens together and captures the match.");
      expect(res).toContain("Named capturing group.");
    });

    it("falls back to literal match message when no tokens matched", () => {
      expect(explainPattern("hello")).toEqual(["Literal character match."]);
    });
  });
});
