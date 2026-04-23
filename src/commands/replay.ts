import { FileStore } from "../persistence/store.js";
import { PipelineRunner } from "../engine/pipeline-runner.js";
import { parsePipeline } from "../parser/pipeline-parser.js";

export interface ReplayOptions {
  dryRun?: boolean;
  verbose: boolean;
  outputFormat: "text" | "json";
}

export async function replayCommand(pipelineId: string, options: ReplayOptions): Promise<void> {
  const store = new FileStore();
  const pipeline = await store.loadPipeline(pipelineId);
  const metadata = await store.loadMetadata(pipelineId);

  if (!pipeline || !metadata) {
    process.stderr.write(`Pipeline '${pipelineId}' not found.\n`);
    process.exit(1);
  }

  // Reconstruct DSL from pipeline steps
  const dsl = pipeline.steps.map(s => s.name).join(" | ");

  if (options.dryRun) {
    console.log(`Would replay pipeline ${pipelineId}:`);
    console.log(`  DSL: ${dsl}`);
    console.log(`  Steps: ${pipeline.steps.length}`);
    if (pipeline.input) {
      console.log(`  Input: ${pipeline.input.slice(0, 100)}${pipeline.input.length > 100 ? "..." : ""}`);
    }
    return;
  }

  if (options.verbose) {
    process.stderr.write(`[cc-pipe] Replaying pipeline ${pipelineId}\n`);
  }

  const ast = parsePipeline(dsl);
  const runner = new PipelineRunner();
  const result = await runner.run(ast.steps, {
    input: pipeline.input,
    verbose: options.verbose,
  });

  if (options.outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.status === "success") {
      console.log(result.finalOutput);
    } else {
      process.stderr.write(`Pipeline replay failed.\n`);
      process.exit(1);
    }
  }
}
