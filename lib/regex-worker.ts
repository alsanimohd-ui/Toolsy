import { explainPattern } from "./regex-analyzer";

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
      explanation: explainPattern(pattern),
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
