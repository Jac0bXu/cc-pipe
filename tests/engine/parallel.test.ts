import { describe, it, expect } from "vitest";
import { parsePipeline } from "../../src/parser/pipeline-parser.js";

describe("parallel parsing", () => {
  it("parses a parallel group", () => {
    const ast = parsePipeline("skill1 | [skill2 & skill3] | skill4");
    expect(ast.steps).toHaveLength(3);

    expect(ast.steps[0].type).toBe("skill");
    expect((ast.steps[0] as any).name).toBe("skill1");

    expect(ast.steps[1].type).toBe("parallel");
    const parallel = ast.steps[1] as any;
    expect(parallel.steps).toHaveLength(2);
    expect(parallel.steps[0].name).toBe("skill2");
    expect(parallel.steps[1].name).toBe("skill3");

    expect(ast.steps[2].type).toBe("skill");
    expect((ast.steps[2] as any).name).toBe("skill4");
  });

  it("parses parallel with merge strategy", () => {
    const ast = parsePipeline("[skill2 & skill3] --merge json-array");
    expect(ast.steps).toHaveLength(1);
    const parallel = ast.steps[0] as any;
    expect(parallel.mergeStrategy).toBe("json-array");
  });

  it("parses three-way parallel", () => {
    const ast = parsePipeline("skill1 | [skill2 & skill3 & skill4] | skill5");
    const parallel = ast.steps[1] as any;
    expect(parallel.steps).toHaveLength(3);
  });

  it("parses parallel with flags on inner steps", () => {
    const ast = parsePipeline("[skill2 --retry 2 & skill3] | skill4");
    const parallel = ast.steps[0] as any;
    expect(parallel.steps[0].flags.retry).toBe(2);
    expect(parallel.steps[1].name).toBe("skill3");
  });
});
