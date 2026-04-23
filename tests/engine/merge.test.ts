import { describe, it, expect } from "vitest";
import { mergeOutputs } from "../../src/engine/parallel-executor.js";
import type { StepResult } from "../../src/models/result.js";

function makeResult(output: string): StepResult {
  return {
    stepId: "test",
    stepName: "test",
    output,
    exitCode: 0,
    durationMs: 0,
    timestamp: 0,
  };
}

describe("mergeOutputs", () => {
  it("concatenates with separator by default", () => {
    const merged = mergeOutputs([makeResult("a"), makeResult("b")]);
    expect(merged).toBe("a\n\n---\n\nb");
  });

  it("returns first result with 'first' strategy", () => {
    const merged = mergeOutputs([makeResult("a"), makeResult("b")], "first");
    expect(merged).toBe("a");
  });

  it("returns last result with 'last' strategy", () => {
    const merged = mergeOutputs([makeResult("a"), makeResult("b")], "last");
    expect(merged).toBe("b");
  });

  it("returns JSON array with 'json-array' strategy", () => {
    const merged = mergeOutputs([makeResult("a"), makeResult("b")], "json-array");
    expect(JSON.parse(merged)).toEqual(["a", "b"]);
  });

  it("handles single result", () => {
    expect(mergeOutputs([makeResult("only")])).toBe("only");
    expect(mergeOutputs([makeResult("only")], "first")).toBe("only");
    expect(mergeOutputs([makeResult("only")], "json-array")).toBe('["only"]');
  });
});
