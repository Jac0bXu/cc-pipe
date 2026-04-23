import {
  type PipelineAST,
  type SkillStepNode,
  type StepFlags,
  type PipelineASTNode,
  type ParallelGroupNode,
  type ConditionalNode,
  type Condition,
  type MergeStrategy,
} from "./ast-types.js";
import { tokenize, TokenType, type Token } from "./pipeline-lexer.js";
import { ParseError } from "../models/errors.js";

export class PipelineParser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): PipelineAST {
    const steps: PipelineASTNode[] = [];

    steps.push(this.parsePipelineNode());

    while (this.match(TokenType.Pipe)) {
      this.advance(); // consume |
      steps.push(this.parsePipelineNode());
    }

    if (!this.match(TokenType.EOF)) {
      throw new ParseError(
        `Unexpected token: ${this.current().value}`,
        this.current().position,
      );
    }

    return { steps };
  }

  private parsePipelineNode(): PipelineASTNode {
    if (this.match(TokenType.LBracket)) {
      return this.parseParallelGroup();
    }
    if (this.match(TokenType.Question)) {
      return this.parseConditionalNode();
    }
    return this.parseSkillStep();
  }

  private parseParallelGroup(): ParallelGroupNode {
    this.advance(); // consume [

    const steps: SkillStepNode[] = [];
    steps.push(this.parseSkillStep());

    while (this.match(TokenType.Ampersand)) {
      this.advance(); // consume &
      steps.push(this.parseSkillStep());
    }

    if (!this.match(TokenType.RBracket)) {
      throw new ParseError(
        `Expected ']' to close parallel group, got ${this.current().value}`,
        this.current().position,
      );
    }
    this.advance(); // consume ]

    // Parse optional --merge flag
    let mergeStrategy: MergeStrategy | undefined;
    if (this.match(TokenType.Flag) && this.peekFlagValue() === "merge") {
      this.advance(); // consume --merge
      if (this.match(TokenType.SkillName)) {
        const strategy = this.advance().value;
        if (["concat", "json-array", "first", "last"].includes(strategy)) {
          mergeStrategy = strategy as MergeStrategy;
        } else {
          throw new ParseError(
            `--merge must be concat, json-array, first, or last, got: ${strategy}`,
          );
        }
      } else {
        throw new ParseError("--merge requires a strategy name");
      }
    }

    return { type: "parallel", steps, mergeStrategy };
  }

  private parseConditionalNode(): ConditionalNode {
    this.advance(); // consume ?

    if (!this.match(TokenType.LBrace)) {
      throw new ParseError("Expected '{' after '?'", this.current().position);
    }
    this.advance(); // consume {

    const condition = this.parseCondition();

    if (!this.match(TokenType.RBrace)) {
      throw new ParseError("Expected '}' to close condition", this.current().position);
    }
    this.advance(); // consume }

    // Expect > thenStep
    if (!this.match(TokenType.Gt)) {
      throw new ParseError("Expected '>' after condition", this.current().position);
    }
    this.advance(); // consume >

    const thenStep = this.parseSkillStepOrParallel();

    // Optional : elseStep
    let elseStep: SkillStepNode | ParallelGroupNode | undefined;
    if (this.match(TokenType.Colon)) {
      this.advance(); // consume :
      elseStep = this.parseSkillStepOrParallel();
    }

    return { type: "conditional", condition, thenStep, elseStep };
  }

  private parseCondition(): Condition {
    // Parse condition type: "contains 'text'" | "matches '/regex/'" | "equals 'text'" | "exit-code N" | "json-path '$.field'"
    if (!this.match(TokenType.SkillName)) {
      throw new ParseError("Expected condition type", this.current().position);
    }

    const condType = this.advance().value;

    switch (condType) {
      case "contains":
      case "matches":
      case "equals": {
        if (this.match(TokenType.String)) {
          return { type: condType, value: this.advance().value };
        }
        // Accept bare word as value
        if (this.match(TokenType.SkillName)) {
          return { type: condType, value: this.advance().value };
        }
        throw new ParseError(`Expected value for ${condType} condition`);
      }
      case "exit-code": {
        if (this.match(TokenType.Number)) {
          return { type: "exit-code", value: this.advance().value };
        }
        throw new ParseError("Expected number for exit-code condition");
      }
      case "json-path": {
        // Collect remaining until } as the value
        let value = "";
        while (!this.match(TokenType.RBrace)) {
          value += this.current().value + " ";
          this.advance();
        }
        return { type: "json-path", value: value.trim() };
      }
      default:
        throw new ParseError(`Unknown condition type: ${condType}`);
    }
  }

  private parseSkillStepOrParallel(): SkillStepNode | ParallelGroupNode {
    if (this.match(TokenType.LBracket)) {
      return this.parseParallelGroup();
    }
    return this.parseSkillStep();
  }

  private peekFlagValue(): string | undefined {
    if (!this.match(TokenType.Flag)) return undefined;
    return this.current().value;
  }

  private parseSkillStep(): SkillStepNode {
    const nameToken = this.expect(TokenType.SkillName);
    const name = nameToken.value;
    const flags = this.parseFlags();

    // Collect remaining tokens as args until we hit a delimiter
    let args: string | undefined;
    const argParts: string[] = [];
    while (this.isArgToken()) {
      if (this.match(TokenType.String)) {
        argParts.push(this.current().value);
        this.advance();
      } else if (this.match(TokenType.SkillName)) {
        argParts.push(this.current().value);
        this.advance();
      } else {
        break;
      }
    }
    if (argParts.length > 0) {
      args = argParts.join(" ");
    }

    return { type: "skill", name, args, flags };
  }

  private isArgToken(): boolean {
    const delimiters = new Set([
      TokenType.Pipe,
      TokenType.EOF,
      TokenType.LBracket,
      TokenType.RBracket,
      TokenType.Ampersand,
      TokenType.Question,
      TokenType.Colon,
      TokenType.Gt,
      TokenType.Flag,
      TokenType.Number,
    ]);
    return !delimiters.has(this.current().type);
  }

  private parseFlags(): StepFlags {
    const flags: StepFlags = {};

    while (this.match(TokenType.Flag)) {
      const flag = this.advance().value;

      switch (flag) {
        case "retry":
          flags.retry = this.parseNumberFlag("retry");
          break;
        case "retry-delay":
          flags.retryDelayMs = this.parseNumberFlag("retry-delay");
          break;
        case "fallback": {
          if (this.match(TokenType.String)) {
            flags.fallback = this.advance().value;
          } else if (this.match(TokenType.SkillName)) {
            flags.fallback = this.advance().value;
          } else {
            throw new ParseError("--fallback requires a skill name");
          }
          if (!flags.onError) flags.onError = "fallback";
          break;
        }
        case "on-error": {
          const value = this.expect(TokenType.SkillName).value;
          if (value !== "stop" && value !== "skip" && value !== "fallback") {
            throw new ParseError(
              `--on-error must be stop, skip, or fallback, got: ${value}`,
            );
          }
          flags.onError = value;
          break;
        }
        default:
          throw new ParseError(`Unknown flag: --${flag}`);
      }
    }

    return flags;
  }

  private parseNumberFlag(flagName: string): number {
    if (!this.match(TokenType.Number)) {
      throw new ParseError(`--${flagName} requires a number`);
    }
    return parseInt(this.advance().value, 10);
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return token;
  }

  private match(type: TokenType): boolean {
    return this.current().type === type;
  }

  private expect(type: TokenType): Token {
    if (!this.match(type)) {
      const current = this.current();
      throw new ParseError(
        `Expected ${type}, got ${current.type} ('${current.value}')`,
        current.position,
      );
    }
    return this.advance();
  }
}

export function parsePipeline(input: string): PipelineAST {
  const tokens = tokenize(input);
  const parser = new PipelineParser(tokens);
  return parser.parse();
}
