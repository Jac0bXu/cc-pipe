import { describe, it, expect } from "vitest";
import { parsePipeline } from "../../src/parser/pipeline-parser.js";
import { ParseError } from "../../src/models/errors.js";

describe("parsePipeline", () => {
  it("parses a simple linear pipeline", () => {
    const ast = parsePipeline("skill1 | skill2 | skill3");
    expect(ast.steps).toHaveLength(3);
    expect(ast.steps[0]).toEqual({
      type: "skill",
      name: "skill1",
      args: undefined,
      flags: {},
    });
    expect(ast.steps[1].name).toBe("skill2");
    expect(ast.steps[2].name).toBe("skill3");
  });

  it("parses a single skill", () => {
    const ast = parsePipeline("skill1");
    expect(ast.steps).toHaveLength(1);
    expect(ast.steps[0].name).toBe("skill1");
  });

  it("parses flags", () => {
    const ast = parsePipeline("skill1 --retry 3 | skill2");
    expect(ast.steps[0].flags.retry).toBe(3);
  });

  it("parses --retry-delay flag", () => {
    const ast = parsePipeline("skill1 --retry 3 --retry-delay 1000 | skill2");
    expect(ast.steps[0].flags.retry).toBe(3);
    expect(ast.steps[0].flags.retryDelayMs).toBe(1000);
  });

  it("parses --fallback flag", () => {
    const ast = parsePipeline("skill1 --retry 2 --fallback cleanup | skill2");
    expect(ast.steps[0].flags.fallback).toBe("cleanup");
    expect(ast.steps[0].flags.onError).toBe("fallback");
  });

  it("parses --fallback with quoted string", () => {
    const ast = parsePipeline("skill1 --fallback 'cleanup-skill' | skill2");
    expect(ast.steps[0].flags.fallback).toBe("cleanup-skill");
  });

  it("parses --on-error flag", () => {
    const ast = parsePipeline("skill1 --on-error skip | skill2");
    expect(ast.steps[0].flags.onError).toBe("skip");
  });

  it("parses string arguments to a step", () => {
    const ast = parsePipeline(`skill1 'some context' | skill2`);
    expect(ast.steps[0].args).toBe("some context");
  });

  it("parses multiple string arguments", () => {
    const ast = parsePipeline(`skill1 'arg1' 'arg2' | skill2`);
    expect(ast.steps[0].args).toBe("arg1 arg2");
  });

  it("throws on unknown flag", () => {
    expect(() => parsePipeline("skill1 --unknown-flag | skill2")).toThrow(ParseError);
  });

  it("throws on invalid --on-error value", () => {
    expect(() => parsePipeline("skill1 --on-error invalid | skill2")).toThrow(ParseError);
  });

  it("throws on --retry without number", () => {
    expect(() => parsePipeline("skill1 --retry | skill2")).toThrow(ParseError);
  });

  it("throws on --fallback without skill name", () => {
    expect(() => parsePipeline("skill1 --fallback | skill2")).toThrow(ParseError);
  });

  it("throws on empty pipeline", () => {
    expect(() => parsePipeline("")).toThrow();
  });
});
