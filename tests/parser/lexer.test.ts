import { describe, it, expect } from "vitest";
import { tokenize, TokenType } from "../../src/parser/pipeline-lexer.js";

describe("tokenize", () => {
  it("tokenizes a simple pipeline", () => {
    const tokens = tokenize("skill1 | skill2 | skill3");
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.SkillName,
      TokenType.Pipe,
      TokenType.SkillName,
      TokenType.Pipe,
      TokenType.SkillName,
      TokenType.EOF,
    ]);
    expect(tokens[0].value).toBe("skill1");
    expect(tokens[2].value).toBe("skill2");
    expect(tokens[4].value).toBe("skill3");
  });

  it("tokenizes flags", () => {
    const tokens = tokenize("skill1 --retry 3 | skill2");
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.SkillName,
      TokenType.Flag,
      TokenType.Number,
      TokenType.Pipe,
      TokenType.SkillName,
      TokenType.EOF,
    ]);
    expect(tokens[1].value).toBe("retry");
    expect(tokens[2].value).toBe("3");
  });

  it("tokenizes quoted strings", () => {
    const tokens = tokenize(`skill1 'hello world' | skill2`);
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.SkillName,
      TokenType.String,
      TokenType.Pipe,
      TokenType.SkillName,
      TokenType.EOF,
    ]);
    expect(tokens[1].value).toBe("hello world");
  });

  it("tokenizes double-quoted strings", () => {
    const tokens = tokenize(`skill1 "hello world" | skill2`);
    expect(tokens[1].value).toBe("hello world");
  });

  it("handles escaped quotes in strings", () => {
    const tokens = tokenize(`skill1 'it\\'s here' | skill2`);
    expect(tokens[1].value).toBe("it's here");
  });

  it("tokenizes parallel syntax", () => {
    const tokens = tokenize("[skill2 & skill3]");
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.LBracket,
      TokenType.SkillName,
      TokenType.Ampersand,
      TokenType.SkillName,
      TokenType.RBracket,
      TokenType.EOF,
    ]);
  });

  it("tokenizes conditional syntax", () => {
    const tokens = tokenize("?{contains 'error'} > handler : fallback");
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.Question,
      TokenType.LBrace,
      TokenType.SkillName,
      TokenType.String,
      TokenType.RBrace,
      TokenType.Gt,
      TokenType.SkillName,
      TokenType.Colon,
      TokenType.SkillName,
      TokenType.EOF,
    ]);
  });

  it("throws on unterminated string", () => {
    expect(() => tokenize("skill1 'unterminated")).toThrow("Unterminated string");
  });

  it("throws on unexpected character", () => {
    expect(() => tokenize("skill1 @ skill2")).toThrow("Unexpected character");
  });

  it("handles hyphenated skill names", () => {
    const tokens = tokenize("my-skill | another-skill");
    expect(tokens[0].value).toBe("my-skill");
    expect(tokens[2].value).toBe("another-skill");
  });

  it("handles empty input", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.EOF);
  });
});
