/**
 * Generates an English explanation list for a given regular expression pattern.
 */
export function explainPattern(pattern: string): string[] {
  if (!pattern) return ["Matches any string."];

  const explanations: string[] = [];

  if (pattern.startsWith("^")) explanations.push("Start of the line/string.");
  if (pattern.endsWith("$")) explanations.push("End of the line/string.");

  if (pattern.includes("\\d")) explanations.push("Matches a digit.");
  if (pattern.includes("\\w")) explanations.push("Matches a word character (alphanumeric).");
  if (pattern.includes("\\s")) explanations.push("Matches a whitespace character.");
  if (pattern.includes("\\b")) explanations.push("Matches a word boundary.");

  if (pattern.includes("+")) explanations.push("Quantifier: Matches 1 or more times.");
  if (pattern.includes("*")) explanations.push("Quantifier: Matches 0 or more times.");
  if (pattern.includes("?")) explanations.push("Quantifier: Matches 0 or 1 time (or makes lazy).");

  if (pattern.includes("[")) explanations.push("Character class: Matches one of the characters inside.");
  if (pattern.includes("(")) explanations.push("Capturing group: Groups multiple tokens together and captures the match.");
  if (pattern.includes("(?<")) explanations.push("Named capturing group.");

  if (explanations.length === 0) {
    explanations.push("Literal character match.");
  }

  return explanations;
}
