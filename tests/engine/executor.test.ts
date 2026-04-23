import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeStep } from "../../src/engine/step-executor.js";
import type { PipelineStep } from "../../src/models/pipeline.js";
import type { ResolvedSkill } from "../../src/engine/skill-resolver.js";

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

function makeStep(overrides: Partial<PipelineStep> = {}): PipelineStep {
  return {
    id: "test-0",
    name: "test-skill",
    ...overrides,
  };
}

function makeResolved(overrides: Partial<ResolvedSkill> = {}): ResolvedSkill {
  return {
    type: "skill",
    name: "test-skill",
    ...overrides,
  };
}

describe("executeStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns successful step result", async () => {
    const claudeOutput = JSON.stringify({
      result: "Hello translated text",
      usage: { input_tokens: 100, output_tokens: 50 },
      total_cost_usd: 0.01,
      session_id: "sess-123",
    });

    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, { stdout: claudeOutput, stderr: "" });
        return {} as any;
      },
    );

    const result = await executeStep(
      makeStep(),
      makeResolved(),
      "Hello world",
    );

    expect(result.output).toBe("Hello translated text");
    expect(result.exitCode).toBe(0);
    expect(result.tokenUsage).toEqual({ input: 100, output: 50 });
    expect(result.costUsd).toBe(0.01);
    expect(result.sessionId).toBe("sess-123");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("handles non-JSON output from claude", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, { stdout: "plain text output", stderr: "" });
        return {} as any;
      },
    );

    const result = await executeStep(
      makeStep(),
      makeResolved(),
      "input",
    );

    expect(result.output).toBe("plain text output");
    expect(result.exitCode).toBe(0);
  });

  it("throws StepExecutionError on failure", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        const err = new Error("Process failed") as NodeJS.ErrnoException;
        err.code = 1;
        (err as any).stdout = "";
        (err as any).stderr = "error details";
        cb(err, { stdout: "", stderr: "error details" });
        return {} as any;
      },
    );

    await expect(
      executeStep(makeStep(), makeResolved(), "input"),
    ).rejects.toThrow("Step 'test-skill' failed");
  });

  it("builds skill-based prompt for resolved skills", async () => {
    let capturedPrompt = "";
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: Function) => {
        capturedPrompt = args[args.length - 1];
        cb(null, { stdout: JSON.stringify({ result: "ok" }), stderr: "" });
        return {} as any;
      },
    );

    await executeStep(makeStep(), makeResolved(), "my input");

    expect(capturedPrompt).toContain("Using the test-skill skill");
    expect(capturedPrompt).toContain("my input");
  });

  it("builds prompt-mode prompt for unresolved skills", async () => {
    let capturedPrompt = "";
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: Function) => {
        capturedPrompt = args[args.length - 1];
        cb(null, { stdout: JSON.stringify({ result: "ok" }), stderr: "" });
        return {} as any;
      },
    );

    await executeStep(
      makeStep({ name: "summarize this text" }),
      makeResolved({ type: "prompt", name: "summarize this text" }),
      "long text here",
    );

    expect(capturedPrompt).toContain("summarize this text");
    expect(capturedPrompt).toContain("long text here");
  });
});
