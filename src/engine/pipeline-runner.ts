import { nanoid } from "nanoid";
import type { PipelineStep, Pipeline } from "../models/pipeline.js";
import type { PipelineResult, StepResult } from "../models/result.js";
import type { PipelineASTNode, SkillStepNode, ParallelGroupNode, ConditionalNode } from "../parser/ast-types.js";
import { resolveSkill } from "./skill-resolver.js";
import { executeStep } from "./step-executor.js";
import { executeParallel, mergeOutputs } from "./parallel-executor.js";
import { evaluateCondition } from "./condition-evaluator.js";
import { MetadataChannel } from "./metadata-channel.js";
import { StepExecutionError } from "../models/errors.js";

export interface PipelineRunnerOptions {
  verbose?: boolean;
  input?: string;
}

export class PipelineRunner {
  private metadata: MetadataChannel;

  constructor() {
    this.metadata = new MetadataChannel();
  }

  async run(
    astSteps: PipelineASTNode[],
    options?: PipelineRunnerOptions,
  ): Promise<PipelineResult> {
    const pipelineId = nanoid(10);

    // Flatten AST nodes to pipeline steps for metadata tracking
    const steps = flattenSteps(astSteps, pipelineId);

    const pipeline: Pipeline = {
      id: pipelineId,
      steps,
      input: options?.input,
      createdAt: Date.now(),
    };

    await this.metadata.init(pipeline);

    if (options?.verbose) {
      process.stderr.write(`[cc-pipe] Pipeline ${pipelineId}: ${summarizePipeline(astSteps)}\n`);
    }

    const results: StepResult[] = [];
    let currentInput = options?.input ?? "";
    const pipelineStart = Date.now();
    let stepMetaIndex = 0;

    for (const node of astSteps) {
      if (node.type === "skill") {
        const result = await this.runSkillStep(
          node, pipelineId, stepMetaIndex, currentInput, options,
        );
        results.push(result);
        currentInput = result.output;
        stepMetaIndex++;
      } else if (node.type === "parallel") {
        const parallelResults = await this.runParallelGroup(
          node, pipelineId, stepMetaIndex, currentInput, options,
        );
        results.push(...parallelResults);
        const merged = mergeOutputs(parallelResults, node.mergeStrategy);
        currentInput = merged;
        stepMetaIndex += parallelResults.length;
      } else if (node.type === "conditional") {
        const lastResult = results.length > 0 ? results[results.length - 1] : undefined;
        const conditionMet = evaluateCondition(node.condition, currentInput, lastResult);

        if (options?.verbose) {
          process.stderr.write(`[cc-pipe] Condition ${node.condition.type} '${node.condition.value}': ${conditionMet ? "true" : "false"}\n`);
        }

        const chosenNode = conditionMet ? node.thenStep : node.elseStep;

        if (chosenNode) {
          if (chosenNode.type === "skill") {
            const result = await this.runSkillStep(
              chosenNode, pipelineId, stepMetaIndex, currentInput, options,
            );
            results.push(result);
            currentInput = result.output;
            stepMetaIndex++;
          } else if (chosenNode.type === "parallel") {
            const parallelResults = await this.runParallelGroup(
              chosenNode, pipelineId, stepMetaIndex, currentInput, options,
            );
            results.push(...parallelResults);
            currentInput = mergeOutputs(parallelResults, chosenNode.mergeStrategy);
            stepMetaIndex += parallelResults.length;
          }
        }
        // If no elseStep and condition is false, pass through unchanged
      }
    }

    await this.metadata.complete(pipelineId, "success");

    return {
      pipelineId,
      results,
      totalDurationMs: Date.now() - pipelineStart,
      status: "success",
      finalOutput: currentInput,
    };
  }

  private async runSkillStep(
    node: SkillStepNode,
    pipelineId: string,
    metaIndex: number,
    input: string,
    options?: PipelineRunnerOptions,
  ): Promise<StepResult> {
    const step = astNodeToStep(node, `${pipelineId}-${metaIndex}`);

    await this.metadata.updateStep(pipelineId, metaIndex, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const resolved = await resolveSkill(step.name);

    let result: StepResult;
    let attempts = 0;
    const maxRetries = step.retry ?? 0;

    while (true) {
      try {
        result = await executeStep(step, resolved, input, { verbose: options?.verbose });
        result.retryAttempts = attempts;
        break;
      } catch (err) {
        attempts++;
        if (attempts <= maxRetries) {
          if (options?.verbose) {
            process.stderr.write(`[cc-pipe] Retry ${attempts}/${maxRetries} for step: ${step.name}\n`);
          }
          if (step.retryDelayMs) {
            await sleep(step.retryDelayMs);
          }
          continue;
        }

        if (step.onError === "fallback" && step.fallback) {
          if (options?.verbose) {
            process.stderr.write(`[cc-pipe] Step '${step.name}' failed, invoking fallback: ${step.fallback}\n`);
          }
          const fallbackStep: PipelineStep = {
            ...step,
            name: step.fallback,
            id: `${step.id}-fallback`,
          };
          const fallbackResolved = await resolveSkill(step.fallback);
          result = await executeStep(fallbackStep, fallbackResolved, input, { verbose: options?.verbose });
          result.fallbackUsed = true;
          result.retryAttempts = attempts;
          break;
        }

        if (step.onError === "skip") {
          result = {
            stepId: step.id,
            stepName: step.name,
            output: input,
            exitCode: 0,
            durationMs: 0,
            timestamp: Date.now(),
            error: err instanceof Error ? err.message : String(err),
          };
          break;
        }

        // Default: stop
        await this.metadata.updateStep(pipelineId, metaIndex, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date().toISOString(),
        });
        await this.metadata.complete(pipelineId, "failed");

        throw err;
      }
    }

    await this.metadata.updateStep(pipelineId, metaIndex, {
      status: "completed",
      completedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      tokenUsage: result.tokenUsage,
      costUsd: result.costUsd,
      sessionId: result.sessionId,
      retryAttempts: result.retryAttempts,
      fallbackUsed: result.fallbackUsed,
    });

    return result;
  }

  private async runParallelGroup(
    node: ParallelGroupNode,
    pipelineId: string,
    metaStartIndex: number,
    input: string,
    options?: PipelineRunnerOptions,
  ): Promise<StepResult[]> {
    if (options?.verbose) {
      process.stderr.write(`[cc-pipe] Running parallel: [${node.steps.map(s => s.name).join(" & ")}]\n`);
    }

    // Update metadata for all parallel steps to "running"
    for (let i = 0; i < node.steps.length; i++) {
      await this.metadata.updateStep(pipelineId, metaStartIndex + i, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
    }

    const steps = node.steps.map((s, i) => astNodeToStep(s, `${pipelineId}-${metaStartIndex + i}`));
    const parallelResults = await executeParallel(steps, input, {
      verbose: options?.verbose,
      mergeStrategy: node.mergeStrategy,
    });

    // Update metadata for each parallel result
    for (let i = 0; i < parallelResults.length; i++) {
      const r = parallelResults[i];
      await this.metadata.updateStep(pipelineId, metaStartIndex + i, {
        status: r.error ? "failed" : "completed",
        completedAt: new Date().toISOString(),
        durationMs: r.durationMs,
        tokenUsage: r.tokenUsage,
        costUsd: r.costUsd,
        error: r.error,
      });
    }

    return parallelResults;
  }
}

function astNodeToStep(node: SkillStepNode, id: string): PipelineStep {
  return {
    id,
    name: node.name,
    args: node.args,
    retry: node.flags.retry,
    retryDelayMs: node.flags.retryDelayMs,
    fallback: node.flags.fallback,
    onError: node.flags.onError,
  };
}

function flattenSteps(nodes: PipelineASTNode[], pipelineId: string): PipelineStep[] {
  const steps: PipelineStep[] = [];
  let index = 0;
  for (const node of nodes) {
    if (node.type === "skill") {
      steps.push(astNodeToStep(node, `${pipelineId}-${index++}`));
    } else if (node.type === "parallel") {
      for (const s of node.steps) {
        steps.push(astNodeToStep(s, `${pipelineId}-${index++}`));
      }
    }
  }
  return steps;
}

function summarizePipeline(nodes: PipelineASTNode[]): string {
  return nodes.map(n => {
    if (n.type === "skill") return n.name;
    if (n.type === "parallel") return `[${n.steps.map(s => s.name).join(" & ")}]`;
    return "?";
  }).join(" | ");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
