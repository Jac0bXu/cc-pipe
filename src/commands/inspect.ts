import { FileStore } from "../persistence/store.js";

export async function inspectCommand(pipelineId: string): Promise<void> {
  const store = new FileStore();
  const metadata = await store.loadMetadata(pipelineId);

  if (!metadata) {
    process.stderr.write(`Pipeline '${pipelineId}' not found.\n`);
    process.exit(1);
  }

  console.log(`Pipeline: ${metadata.pipelineId}`);
  console.log(`Status:   ${metadata.status}`);
  console.log(`Started:  ${metadata.startedAt}`);
  if (metadata.completedAt) {
    console.log(`Finished: ${metadata.completedAt}`);
  }
  console.log();

  for (const step of metadata.steps) {
    const icon = step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "○";
    const duration = step.durationMs ? ` (${step.durationMs}ms)` : "";
    console.log(`  ${icon} [${step.index}] ${step.name} — ${step.status}${duration}`);
    if (step.error) {
      console.log(`    Error: ${step.error}`);
    }
    if (step.retryAttempts && step.retryAttempts > 0) {
      console.log(`    Retries: ${step.retryAttempts}`);
    }
    if (step.tokenUsage) {
      console.log(`    Tokens: ${step.tokenUsage.input} in / ${step.tokenUsage.output} out`);
    }
    if (step.costUsd !== undefined) {
      console.log(`    Cost: $${step.costUsd.toFixed(4)}`);
    }
  }
}
