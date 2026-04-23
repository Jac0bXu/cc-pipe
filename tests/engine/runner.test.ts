import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipelineRunner } from "../../src/engine/pipeline-runner.js";
import type { SkillStepNode } from "../../src/parser/ast-types.js";

// Mock the step executor to avoid real claude calls
vi.mock("../../src/engine/step-executor.js", () => ({
  executeStep: vi.fn(),
}));

// Mock skill resolver
vi.mock("../../src/engine/skill-resolver.js", () => ({
  resolveSkill: vi.fn().mockResolvedValue({ type: "skill", name: "mock-skill" }),
}));

import { executeStep } from "../../src/engine/step-executor.js";
const mockExecuteStep = vi.mocked(executeStep);

describe("PipelineRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs a linear pipeline sequentially", async () => {
    mockExecuteStep
      .mockResolvedValueOnce({
        stepId: "test-0",
        stepName: "step-a",
        output: "output from a",
        exitCode: 0,
        durationMs: 100,
        timestamp: Date.now(),
      })
      .mockResolvedValueOnce({
        stepId: "test-1",
        stepName: "step-b",
        output: "output from b",
        exitCode: 0,
        durationMs: 200,
        timestamp: Date.now(),
      });

    const runner = new PipelineRunner();
    const steps: SkillStepNode[] = [
      { type: "skill", name: "step-a", flags: {} },
      { type: "skill", name: "step-b", flags: {} },
    ];

    const result = await runner.run(steps);

    expect(result.status).toBe("success");
    expect(result.results).toHaveLength(2);
    expect(result.finalOutput).toBe("output from b");

    // Verify that step-b received step-a's output as input
    expect(mockExecuteStep).toHaveBeenCalledTimes(2);
    // First call gets initial (empty) input
    expect(mockExecuteStep.mock.calls[0][2]).toBe("");
    // Second call gets first step's output
    expect(mockExecuteStep.mock.calls[1][2]).toBe("output from a");
  });

  it("runs with initial input", async () => {
    mockExecuteStep.mockResolvedValue({
      stepId: "test-0",
      stepName: "step-a",
      output: "processed",
      exitCode: 0,
      durationMs: 100,
      timestamp: Date.now(),
    });

    const runner = new PipelineRunner();
    const steps: SkillStepNode[] = [
      { type: "skill", name: "step-a", flags: {} },
    ];

    const result = await runner.run(steps, { input: "initial text" });

    expect(mockExecuteStep.mock.calls[0][2]).toBe("initial text");
    expect(result.status).toBe("success");
  });

  it("stops on failure by default", async () => {
    mockExecuteStep
      .mockResolvedValueOnce({
        stepId: "test-0",
        stepName: "step-a",
        output: "ok",
        exitCode: 0,
        durationMs: 100,
        timestamp: Date.now(),
      })
      .mockRejectedValueOnce(new Error("Step failed"));

    const runner = new PipelineRunner();
    const steps: SkillStepNode[] = [
      { type: "skill", name: "step-a", flags: {} },
      { type: "skill", name: "step-b", flags: {} },
      { type: "skill", name: "step-c", flags: {} },
    ];

    await expect(runner.run(steps)).rejects.toThrow("Step failed");
    expect(mockExecuteStep).toHaveBeenCalledTimes(2); // a succeeded, b failed
  });

  it("skips failing step when --on-error skip", async () => {
    mockExecuteStep
      .mockResolvedValueOnce({
        stepId: "test-0",
        stepName: "step-a",
        output: "input-for-b",
        exitCode: 0,
        durationMs: 100,
        timestamp: Date.now(),
      })
      .mockRejectedValueOnce(new Error("Step failed"))
      .mockResolvedValueOnce({
        stepId: "test-2",
        stepName: "step-c",
        output: "final",
        exitCode: 0,
        durationMs: 100,
        timestamp: Date.now(),
      });

    const runner = new PipelineRunner();
    const steps: SkillStepNode[] = [
      { type: "skill", name: "step-a", flags: {} },
      { type: "skill", name: "step-b", flags: { onError: "skip" } },
      { type: "skill", name: "step-c", flags: {} },
    ];

    const result = await runner.run(steps);

    expect(result.status).toBe("success");
    expect(result.results).toHaveLength(3);
    expect(result.finalOutput).toBe("final");
    // step-c should receive step-a's output since step-b was skipped
    expect(mockExecuteStep.mock.calls[2][2]).toBe("input-for-b");
  });

  it("retries failing step", async () => {
    mockExecuteStep
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce({
        stepId: "test-0",
        stepName: "step-a",
        output: "succeeded on retry",
        exitCode: 0,
        durationMs: 100,
        timestamp: Date.now(),
      });

    const runner = new PipelineRunner();
    const steps: SkillStepNode[] = [
      { type: "skill", name: "step-a", flags: { retry: 2 } },
    ];

    const result = await runner.run(steps);

    expect(result.status).toBe("success");
    expect(result.finalOutput).toBe("succeeded on retry");
    expect(result.results[0].retryAttempts).toBe(2);
    expect(mockExecuteStep).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
