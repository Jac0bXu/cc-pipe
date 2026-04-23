import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { inspectCommand } from "./commands/inspect.js";
import { listCommand } from "./commands/list.js";
import { resumeCommand } from "./commands/resume.js";
import { replayCommand } from "./commands/replay.js";

const program = new Command();

program
  .name("cc-pipe")
  .description("Pipe operator for Claude Code skills — Unix-style skill composition")
  .version("0.1.0");

program
  .argument("[dsl]", "Pipeline DSL expression (e.g., 'skill1 | skill2 | skill3')")
  .action(async (dsl: string | undefined) => {
    if (!dsl) {
      program.help();
      return;
    }
    await runCommand(dsl, {
      outputFormat: "text",
      verbose: false,
    });
  });

program
  .command("run")
  .description("Run a pipeline")
  .argument("<dsl>", "Pipeline DSL expression")
  .option("-i, --input <text>", "Initial input text")
  .option("-f, --output-format <format>", "Output format: text or json", "text")
  .option("-v, --verbose", "Show step-by-step progress", false)
  .action(async (dsl: string, opts: { input?: string; outputFormat: string; verbose: boolean }) => {
    await runCommand(dsl, {
      input: opts.input,
      outputFormat: opts.outputFormat as "text" | "json",
      verbose: opts.verbose,
    });
  });

program
  .command("list")
  .description("List past pipeline runs")
  .action(async () => {
    await listCommand();
  });

program
  .command("inspect")
  .description("Inspect a pipeline run")
  .argument("<pipeline-id>", "Pipeline ID to inspect")
  .action(async (pipelineId: string) => {
    await inspectCommand(pipelineId);
  });

program
  .command("resume")
  .description("Resume a failed pipeline from last checkpoint")
  .argument("<pipeline-id>", "Pipeline ID to resume")
  .option("--from-step <n>", "Resume from a specific step number")
  .option("--input <text>", "Override initial input")
  .option("-f, --output-format <format>", "Output format: text or json", "text")
  .option("-v, --verbose", "Show step-by-step progress", false)
  .action(async (pipelineId: string, opts: {
    fromStep?: string;
    input?: string;
    outputFormat: string;
    verbose: boolean;
  }) => {
    await resumeCommand(pipelineId, {
      fromStep: opts.fromStep ? parseInt(opts.fromStep, 10) : undefined,
      input: opts.input,
      outputFormat: opts.outputFormat as "text" | "json",
      verbose: opts.verbose,
    });
  });

program
  .command("replay")
  .description("Re-run a previous pipeline")
  .argument("<pipeline-id>", "Pipeline ID to replay")
  .option("--dry-run", "Show what would be executed without running", false)
  .option("-f, --output-format <format>", "Output format: text or json", "text")
  .option("-v, --verbose", "Show step-by-step progress", false)
  .action(async (pipelineId: string, opts: {
    dryRun?: boolean;
    outputFormat: string;
    verbose: boolean;
  }) => {
    await replayCommand(pipelineId, {
      dryRun: opts.dryRun,
      outputFormat: opts.outputFormat as "text" | "json",
      verbose: opts.verbose,
    });
  });

program.parse();
