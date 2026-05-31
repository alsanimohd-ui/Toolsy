interface RegexMatch {
  match: string;
  index: number;
  length: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

interface WorkerInput {
  pattern: string;
  flags: string;
  testString: string;
  replaceString?: string;
}

interface WorkerOutput {
  isValid: boolean;
  error?: string;
  matches: RegexMatch[];
  explanation: string[];
  executionTime: number;
  replacedText: string;
  timedOut?: boolean;
}

function generateExplanation(pattern: string): string[] {
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
  if (explanations.length === 0) explanations.push("Literal character match.");
  return explanations;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { pattern, flags, testString, replaceString } = e.data;
  const start = performance.now();
  const TIMEOUT_MS = 5000;

  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];

    if (pattern) {
      if (flags.includes("g")) {
        let match;
        let count = 0;
        while ((match = regex.exec(testString)) !== null && count < 5000) {
          matches.push({
            match: match[0],
            index: match.index,
            length: match[0].length,
            groups: match.slice(1),
            namedGroups: match.groups || {},
          });
          count++;
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
          if (count % 100 === 0 && performance.now() - start > TIMEOUT_MS) {
            const result: WorkerOutput = {
              isValid: false,
              error:
                "Execution timed out after 5 seconds. Your pattern may be causing catastrophic backtracking.",
              matches,
              explanation: [],
              executionTime: performance.now() - start,
              replacedText: testString,
              timedOut: true,
            };
            self.postMessage(result);
            return;
          }
        }
      } else {
        const match = regex.exec(testString);
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            length: match[0].length,
            groups: match.slice(1),
            namedGroups: match.groups || {},
          });
        }
      }
    }

    let replacedText = testString;
    if (replaceString !== undefined && pattern) {
      replacedText = testString.replace(new RegExp(pattern, flags), replaceString);
    }

    const result: WorkerOutput = {
      isValid: true,
      matches,
      explanation: generateExplanation(pattern),
      executionTime: performance.now() - start,
      replacedText,
    };

    self.postMessage(result);
  } catch (err: unknown) {
    const result: WorkerOutput = {
      isValid: false,
      error: err instanceof Error ? err.message : "Invalid Regular Expression",
      matches: [],
      explanation: [],
      executionTime: performance.now() - start,
      replacedText: testString,
    };
    self.postMessage(result);
  }
};
