import { describe, it, expect } from "vitest";
import { parsePipeline } from "../../src/parser/pipeline-parser.js";

describe("conditional parsing", () => {
  it("parses a conditional with then and else", () => {
    const ast = parsePipeline("skill1 | ?{contains 'error'} > handler : fallback");
    expect(ast.steps).toHaveLength(2);

    expect(ast.steps[0].type).toBe("skill");

    const cond = ast.steps[1] as any;
    expect(cond.type).toBe("conditional");
    expect(cond.condition).toEqual({ type: "contains", value: "error" });
    expect(cond.thenStep.name).toBe("handler");
    expect(cond.elseStep.name).toBe("fallback");
  });

  it("parses a conditional without else (pass-through)", () => {
    const ast = parsePipeline("skill1 | ?{contains 'error'} > handler | skill3");
    expect(ast.steps).toHaveLength(3);

    const cond = ast.steps[1] as any;
    expect(cond.type).toBe("conditional");
    expect(cond.thenStep.name).toBe("handler");
    expect(cond.elseStep).toBeUndefined();
    expect(ast.steps[2].type).toBe("skill");
  });

  it("parses matches condition with regex", () => {
    const ast = parsePipeline("?{matches '/^ERROR/'} > handle-error : process");
    const cond = ast.steps[0] as any;
    expect(cond.condition).toEqual({ type: "matches", value: "/^ERROR/" });
  });

  it("parses equals condition", () => {
    const ast = parsePipeline("?{equals 'done'} > finish : retry");
    const cond = ast.steps[0] as any;
    expect(cond.condition).toEqual({ type: "equals", value: "done" });
  });

  it("parses exit-code condition", () => {
    const ast = parsePipeline("?{exit-code 0} > success : failure");
    const cond = ast.steps[0] as any;
    expect(cond.condition).toEqual({ type: "exit-code", value: "0" });
  });
});
