import { FileStore } from "../persistence/store.js";
import { MetadataChannel } from "../engine/metadata-channel.js";
import { PipelineRunner } from "../engine/pipeline-runner.js";
import { parsePipeline } from "../parser/pipeline-parser.js";
import type { PipelineASTNode, SkillStepNode, ParallelGroupNode } from "../parser/ast-types.js";

export interface ResumeOptions {
  fromStep?: number;
  input?: string;
  verbose: boolean;
  outputFormat: "text" | "json";
}

export async function resumeCommand(pipelineId: string, options: ResumeOptions): Promise<void> {
  const store = new FileStore();
  const channel = new MetadataChannel();

  const pipeline = await store.loadPipeline(pipelineId);
  const metadata = await store.loadMetadata(pipelineId);

  if (!pipeline || !metadata) {
    process.stderr.write(`Pipeline '${pipelineId}' not found.\n`);
    process.exit(1);
  }

  // Find the last successful step
  let resumeFrom = options.fromStep;
  if (resumeFrom === undefined) {
    resumeFrom = metadata.steps.findIndex(s => s.status === "failed" || s.status === "running");
    if (resumeFrom === -1) {
      resumeFrom = metadata.steps.length; // all completed
    }
  }

  if (resumeFrom === 0) {
    process.stderr.write(`Nothing to resume — pipeline hasn't started or is fully complete.\n`);
    return;
  }

  if (options.verbose) {
    process.stderr.write(`[cc-pipe] Resuming pipeline ${pipelineId} from step ${resumeFrom}\n`);
  }

  // Reconstruct the DSL from the pipeline steps and re-parse
  // We need to run only the remaining steps
  const remainingSteps = pipeline.steps.slice(resumeFrom);

  // Build a simplified DSL for remaining steps
  const dsl = remainingSteps.map(s => s.name).join(" | ");
  const ast = parsePipeline(dsl);

  // Get the last successful output as input
  let input = options.input;
  if (!input && resumeFrom > 0) {
    const lastOutput = await channel.getStepOutput(pipelineId, resumeFrom - 1);
    input = lastOutput ?? "";
  }

  // Run remaining steps
  const runner = new PipelineRunner();
  const result = await runner.run(ast.steps, {
    input,
    verbose: options.verbose,
  });

  if (options.outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.status === "success") {
      console.log(result.finalOutput);
    } else {
      process.stderr.write(`Pipeline resume failed.\n`);
      process.exit(1);
    }
  }
}
