import type { PipelineStep } from "../models/pipeline.js";
import type { StepResult } from "../models/result.js";
import { executeStep } from "./step-executor.js";
import type { ResolvedSkill } from "./skill-resolver.js";
import { resolveSkill } from "./skill-resolver.js";

export type MergeStrategy = "concat" | "json-array" | "first" | "last";

export interface ParallelOptions {
  verbose?: boolean;
  maxConcurrency?: number;
  mergeStrategy?: MergeStrategy;
}

export async function executeParallel(
  steps: PipelineStep[],
  input: string,
  options?: ParallelOptions,
): Promise<StepResult[]> {
  const maxConcurrency = options?.maxConcurrency ?? steps.length;

  // Resolve all skills upfront
  const resolved: ResolvedSkill[] = await Promise.all(
    steps.map(step => resolveSkill(step.name)),
  );

  // Execute with bounded concurrency
  const results: StepResult[] = new Array(steps.length);
  const executing: Promise<void>[] = [];

  let nextIndex = 0;

  function spawnNext(): Promise<void> | undefined {
    if (nextIndex >= steps.length) return undefined;
    const index = nextIndex++;
    const step = steps[index];
    const resolvedSkill = resolved[index];

    return executeStep(step, resolvedSkill, input, { verbose: options?.verbose })
      .then(result => { results[index] = result; })
      .catch(err => {
        results[index] = {
          stepId: step.id,
          stepName: step.name,
          output: "",
          exitCode: 1,
          durationMs: 0,
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
      });
  }

  // Launch initial batch
  for (let i = 0; i < Math.min(maxConcurrency, steps.length); i++) {
    const p = spawnNext();
    if (p) executing.push(p);
  }

  // As each completes, spawn the next
  while (executing.length > 0) {
    await Promise.race(executing);
    // Remove completed promises
    for (let i = executing.length - 1; i >= 0; i--) {
      // Promise.race resolved means at least one finished
      // We use a different approach: just await all
    }
    break; // Simplify: just use Promise.all for now
  }

  // Actually, simpler approach: just use Promise.all with bounded concurrency via a semaphore
  const semaphore = new Semaphore(maxConcurrency);
  const tasks = steps.map(async (step, index) => {
    await semaphore.acquire();
    try {
      results[index] = await executeStep(step, resolved[index], input, {
        verbose: options?.verbose,
      });
    } catch (err) {
      results[index] = {
        stepId: step.id,
        stepName: step.name,
        output: "",
        exitCode: 1,
        durationMs: 0,
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(tasks);
  return results;
}

export function mergeOutputs(
  results: StepResult[],
  strategy: MergeStrategy = "concat",
): string {
  switch (strategy) {
    case "first":
      return results[0]?.output ?? "";
    case "last":
      return results[results.length - 1]?.output ?? "";
    case "json-array":
      return JSON.stringify(results.map(r => r.output));
    case "concat":
    default:
      return results.map(r => r.output).join("\n\n---\n\n");
  }
}

class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}
