export enum TokenType {
  SkillName = "SkillName",
  Pipe = "Pipe",
  String = "String",
  Flag = "Flag",
  Number = "Number",
  LParen = "LParen",
  RParen = "RParen",
  LBracket = "LBracket",
  RBracket = "RBracket",
  Ampersand = "Ampersand",
  Question = "Question",
  LBrace = "LBrace",
  RBrace = "RBrace",
  Colon = "Colon",
  Gt = "Gt",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const SKILL_NAME_RE = /^[a-z][a-z0-9-]*$/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos])) {
      pos++;
      continue;
    }

    // Pipe operator
    if (input[pos] === "|") {
      tokens.push({ type: TokenType.Pipe, value: "|", position: pos });
      pos++;
      continue;
    }

    // Single-quoted string
    if (input[pos] === "'") {
      const start = pos;
      pos++;
      let value = "";
      while (pos < input.length && input[pos] !== "'") {
        if (input[pos] === "\\" && pos + 1 < input.length) {
          pos++;
          value += input[pos];
        } else {
          value += input[pos];
        }
        pos++;
      }
      if (pos >= input.length) {
        throw new Error(`Unterminated string at position ${start}`);
      }
      pos++; // closing quote
      tokens.push({ type: TokenType.String, value, position: start });
      continue;
    }

    // Double-quoted string
    if (input[pos] === '"') {
      const start = pos;
      pos++;
      let value = "";
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === "\\" && pos + 1 < input.length) {
          pos++;
          value += input[pos];
        } else {
          value += input[pos];
        }
        pos++;
      }
      if (pos >= input.length) {
        throw new Error(`Unterminated string at position ${start}`);
      }
      pos++; // closing quote
      tokens.push({ type: TokenType.String, value, position: start });
      continue;
    }

    // Flags (--retry, --fallback, etc.)
    if (input[pos] === "-" && pos + 1 < input.length && input[pos + 1] === "-") {
      const start = pos;
      pos += 2;
      let value = "";
      while (pos < input.length && /[a-z-]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      tokens.push({ type: TokenType.Flag, value, position: start });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(input[pos])) {
      const start = pos;
      let value = "";
      while (pos < input.length && /[0-9]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      tokens.push({ type: TokenType.Number, value, position: start });
      continue;
    }

    // Special characters
    if (input[pos] === "[") {
      tokens.push({ type: TokenType.LBracket, value: "[", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "]") {
      tokens.push({ type: TokenType.RBracket, value: "]", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "&") {
      tokens.push({ type: TokenType.Ampersand, value: "&", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "?") {
      tokens.push({ type: TokenType.Question, value: "?", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "{") {
      tokens.push({ type: TokenType.LBrace, value: "{", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "}") {
      tokens.push({ type: TokenType.RBrace, value: "}", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === ":") {
      tokens.push({ type: TokenType.Colon, value: ":", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === ">") {
      tokens.push({ type: TokenType.Gt, value: ">", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === "(") {
      tokens.push({ type: TokenType.LParen, value: "(", position: pos });
      pos++;
      continue;
    }
    if (input[pos] === ")") {
      tokens.push({ type: TokenType.RParen, value: ")", position: pos });
      pos++;
      continue;
    }

    // Skill names and identifiers
    if (/[a-zA-Z_]/.test(input[pos])) {
      const start = pos;
      let value = "";
      while (pos < input.length && /[a-zA-Z0-9_.-]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      tokens.push({ type: TokenType.SkillName, value, position: start });
      continue;
    }

    throw new Error(`Unexpected character '${input[pos]}' at position ${pos}`);
  }

  tokens.push({ type: TokenType.EOF, value: "", position: pos });
  return tokens;
}
