import { parsePipeline } from "../parser/pipeline-parser.js";
import { PipelineRunner } from "../engine/pipeline-runner.js";

export interface RunOptions {
  input?: string;
  outputFormat: "text" | "json";
  verbose: boolean;
}

export async function runCommand(dsl: string, options: RunOptions): Promise<void> {
  // Parse the DSL
  const ast = parsePipeline(dsl);

  // Run the pipeline
  const runner = new PipelineRunner();
  const result = await runner.run(ast.steps, {
    input: options.input,
    verbose: options.verbose,
  });

  // Output results
  if (options.outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.status === "success") {
      console.log(result.finalOutput);
    } else {
      process.stderr.write(`Pipeline failed.\n`);
      for (const r of result.results) {
        if (r.error) {
          process.stderr.write(`  Step ${r.stepName}: ${r.error}\n`);
        }
      }
      process.exit(1);
    }
  }
}
