import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../../src/engine/condition-evaluator.js";

describe("evaluateCondition", () => {
  it("evaluates 'contains' condition", () => {
    expect(evaluateCondition({ type: "contains", value: "error" }, "this has an error in it")).toBe(true);
    expect(evaluateCondition({ type: "contains", value: "error" }, "all good here")).toBe(false);
  });

  it("evaluates 'matches' condition with regex", () => {
    expect(evaluateCondition({ type: "matches", value: "/^ERROR/" }, "ERROR: something broke")).toBe(true);
    expect(evaluateCondition({ type: "matches", value: "/^ERROR/" }, "warning: something broke")).toBe(false);
  });

  it("evaluates 'matches' with flags", () => {
    expect(evaluateCondition({ type: "matches", value: "/error/i" }, "ERROR HERE")).toBe(true);
  });

  it("evaluates 'equals' condition", () => {
    expect(evaluateCondition({ type: "equals", value: "done" }, "done")).toBe(true);
    expect(evaluateCondition({ type: "equals", value: "done" }, "done\n")).toBe(true); // trims
    expect(evaluateCondition({ type: "equals", value: "done" }, "not done")).toBe(false);
  });

  it("evaluates 'exit-code' condition", () => {
    expect(
      evaluateCondition({ type: "exit-code", value: "0" }, "output", {
        stepId: "x", stepName: "x", output: "x", exitCode: 0, durationMs: 0, timestamp: 0,
      }),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "exit-code", value: "1" }, "output", {
        stepId: "x", stepName: "x", output: "x", exitCode: 1, durationMs: 0, timestamp: 0,
      }),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "exit-code", value: "0" }, "output", {
        stepId: "x", stepName: "x", output: "x", exitCode: 1, durationMs: 0, timestamp: 0,
      }),
    ).toBe(false);
  });

  it("evaluates 'json-path' condition for existence", () => {
    expect(evaluateCondition({ type: "json-path", value: "$.status" }, '{"status":"ok"}')).toBe(true);
    expect(evaluateCondition({ type: "json-path", value: "$.status" }, '{"name":"test"}')).toBe(false);
  });

  it("evaluates 'json-path' condition with equals comparison", () => {
    expect(
      evaluateCondition({ type: "json-path", value: "$.status equals 'error'" }, '{"status":"error"}'),
    ).toBe(true);
    expect(
      evaluateCondition({ type: "json-path", value: "$.status equals 'ok'" }, '{"status":"error"}'),
    ).toBe(false);
  });

  it("returns false for invalid JSON with json-path", () => {
    expect(evaluateCondition({ type: "json-path", value: "$.status" }, "not json")).toBe(false);
  });

  it("returns false for exit-code without lastResult", () => {
    expect(evaluateCondition({ type: "exit-code", value: "0" }, "output")).toBe(false);
  });
});
