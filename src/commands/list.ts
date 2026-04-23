import { FileStore } from "../persistence/store.js";

export async function listCommand(): Promise<void> {
  const store = new FileStore();
  const pipelines = await store.listPipelines();

  if (pipelines.length === 0) {
    console.log("No pipelines found.");
    return;
  }

  for (const p of pipelines) {
    const icon = p.status === "success" ? "✓" : p.status === "failed" ? "✗" : "○";
    const time = new Date(p.startedAt).toLocaleString();
    console.log(`  ${icon} ${p.id}  ${p.status.padEnd(8)}  ${p.stepCount} steps  ${time}`);
  }
}
