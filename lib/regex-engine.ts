export interface RegexMatch {
  match: string;
  index: number;
  length: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export interface RegexEngineResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatch[];
  explanation: string[];
  executionTime: number;
  replacedText: string;
}

/**
 * Basic explanation generator mapping common regex tokens to English.
 * Note: A true AST parser would be better, but this handles basic structures.
 */
function generateExplanation(pattern: string): string[] {
  if (!pattern) return ["Matches any string."];
  
  const explanations: string[] = [];
  
  if (pattern.startsWith('^')) explanations.push("Start of the line/string.");
  if (pattern.endsWith('$')) explanations.push("End of the line/string.");
  
  if (pattern.includes('\\d')) explanations.push("Matches a digit.");
  if (pattern.includes('\\w')) explanations.push("Matches a word character (alphanumeric).");
  if (pattern.includes('\\s')) explanations.push("Matches a whitespace character.");
  if (pattern.includes('\\b')) explanations.push("Matches a word boundary.");
  
  if (pattern.includes('+')) explanations.push("Quantifier: Matches 1 or more times.");
  if (pattern.includes('*')) explanations.push("Quantifier: Matches 0 or more times.");
  if (pattern.includes('?')) explanations.push("Quantifier: Matches 0 or 1 time (or makes lazy).");
  
  if (pattern.includes('[')) explanations.push("Character class: Matches one of the characters inside.");
  if (pattern.includes('(')) explanations.push("Capturing group: Groups multiple tokens together and captures the match.");
  if (pattern.includes('(?<')) explanations.push("Named capturing group.");
  
  if (explanations.length === 0) {
    explanations.push("Literal character match.");
  }
  
  return explanations;
}

export function executeRegex(
  pattern: string,
  flags: string,
  testString: string,
  replaceString?: string
): RegexEngineResult {
  const start = performance.now();
  
  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];
    
    // Safety check against catastrophic backtracking
    // In a real prod env, we'd run this in a Web Worker with a timeout.
    // For now, we will limit matches or string length.
    const safeString = testString; // Limit string size if needed
    
    if (pattern) {
      if (flags.includes('g')) {
        let match;
        let count = 0;
        while ((match = regex.exec(safeString)) !== null && count < 5000) {
          matches.push({
            match: match[0],
            index: match.index,
            length: match[0].length,
            groups: match.slice(1),
            namedGroups: match.groups || {}
          });
          count++;
          // Prevent infinite loops with zero-length matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        const match = regex.exec(safeString);
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            length: match[0].length,
            groups: match.slice(1),
            namedGroups: match.groups || {}
          });
        }
      }
    }

    let replacedText = testString;
    if (replaceString !== undefined && pattern) {
      replacedText = testString.replace(new RegExp(pattern, flags), replaceString);
    }

    const end = performance.now();

    return {
      isValid: true,
      matches,
      explanation: generateExplanation(pattern),
      executionTime: end - start,
      replacedText
    };
    
  } catch (err: unknown) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : "Invalid Regular Expression",
      matches: [],
      explanation: [],
      executionTime: 0,
      replacedText: testString
    };
  }
}
