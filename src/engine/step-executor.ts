import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PipelineStep } from "../models/pipeline.js";
import type { StepResult } from "../models/result.js";
import { StepExecutionError } from "../models/errors.js";
import type { ResolvedSkill } from "./skill-resolver.js";

const execFileAsync = promisify(execFile);

export interface StepExecutorOptions {
  verbose?: boolean;
}

export async function executeStep(
  step: PipelineStep,
  resolved: ResolvedSkill,
  input: string,
  options?: StepExecutorOptions,
): Promise<StepResult> {
  const startTime = Date.now();
  const timestamp = startTime;

  const prompt = buildPrompt(resolved, step, input);

  if (options?.verbose) {
    process.stderr.write(`[cc-pipe] Running step: ${step.name}\n`);
  }

  try {
    const { stdout } = await execFileAsync("claude", [
      "--print",
      "--output-format",
      "json",
      prompt,
    ], {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 10 * 60 * 1000, // 10 min timeout
    });

    const durationMs = Date.now() - startTime;
    const parsed = parseClaudeOutput(stdout);

    return {
      stepId: step.id,
      stepName: step.name,
      output: parsed.text,
      exitCode: 0,
      durationMs,
      timestamp,
      tokenUsage: parsed.tokenUsage,
      costUsd: parsed.costUsd,
      sessionId: parsed.sessionId,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (err instanceof Error && "code" in err) {
      const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const output = execErr.stdout || "";
      const parsed = parseClaudeOutput(output);

      throw new StepExecutionError(
        `Step '${step.name}' failed: ${execErr.message}`,
        step.id,
        step.name,
        typeof execErr.code === "number" ? execErr.code : 1,
        execErr.stdout,
        execErr.stderr,
      );
    }

    throw new StepExecutionError(
      `Step '${step.name}' failed: ${err instanceof Error ? err.message : String(err)}`,
      step.id,
      step.name,
      1,
    );
  }
}

function buildPrompt(resolved: ResolvedSkill, step: PipelineStep, input: string): string {
  if (resolved.type === "skill") {
    let prompt = `Using the ${resolved.name} skill, process the following input`;
    if (step.args) {
      prompt += ` (additional context: ${step.args})`;
    }
    prompt += `:\n\n${input}`;
    return prompt;
  }

  // Raw prompt mode — treat name as instruction
  let prompt = step.name;
  if (step.args) {
    prompt += ` ${step.args}`;
  }
  prompt += `\n\nInput:\n${input}`;
  return prompt;
}

interface ClaudeOutput {
  text: string;
  tokenUsage?: { input: number; output: number };
  costUsd?: number;
  sessionId?: string;
}

function parseClaudeOutput(raw: string): ClaudeOutput {
  try {
    const json = JSON.parse(raw);
    return {
      text: json.result ?? raw,
      tokenUsage: json.usage ? {
        input: json.usage.input_tokens ?? json.usage.input ?? 0,
        output: json.usage.output_tokens ?? json.usage.output ?? 0,
      } : undefined,
      costUsd: json.total_cost_usd ?? json.cost_usd,
      sessionId: json.session_id,
    };
  } catch {
    // Not JSON, return raw text
    return { text: raw };
  }
}
