import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Pipeline } from "../models/pipeline.js";
import type { PipelineMetadata } from "../models/result.js";

const DEFAULT_STATE_DIR = ".cc-pipe";

export interface PipelineSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  stepCount: number;
}

export class FileStore {
  private stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir ?? DEFAULT_STATE_DIR;
  }

  async loadPipeline(pipelineId: string): Promise<Pipeline | null> {
    try {
      const raw = await readFile(join(this.stateDir, pipelineId, "pipeline.json"), "utf-8");
      return JSON.parse(raw) as Pipeline;
    } catch {
      return null;
    }
  }

  async loadMetadata(pipelineId: string): Promise<PipelineMetadata | null> {
    try {
      const raw = await readFile(join(this.stateDir, pipelineId, "metadata.json"), "utf-8");
      return JSON.parse(raw) as PipelineMetadata;
    } catch {
      return null;
    }
  }

  async loadStepOutput(pipelineId: string, stepIndex: number): Promise<string | null> {
    try {
      return await readFile(
        join(this.stateDir, pipelineId, "steps", `${stepIndex}.txt`),
        "utf-8",
      );
    } catch {
      return null;
    }
  }

  async listPipelines(): Promise<PipelineSummary[]> {
    if (!existsSync(this.stateDir)) return [];

    const entries = await readdir(this.stateDir, { withFileTypes: true });
    const summaries: PipelineSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metadata = await this.loadMetadata(entry.name);
      if (metadata) {
        summaries.push({
          id: metadata.pipelineId,
          status: metadata.status,
          startedAt: metadata.startedAt,
          completedAt: metadata.completedAt,
          stepCount: metadata.steps.length,
        });
      }
    }

    return summaries.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  async deletePipeline(pipelineId: string): Promise<void> {
    await rm(join(this.stateDir, pipelineId), { recursive: true, force: true });
  }
}
