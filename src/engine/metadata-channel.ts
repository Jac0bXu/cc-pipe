import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Pipeline } from "../models/pipeline.js";
import type { PipelineMetadata, StepMetadata } from "../models/result.js";

const DEFAULT_STATE_DIR = ".cc-pipe";

export class MetadataChannel {
  private stateDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir ?? DEFAULT_STATE_DIR;
  }

  async init(pipeline: Pipeline): Promise<void> {
    const dir = this.pipelineDir(pipeline.id);
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "steps"), { recursive: true });

    // Write pipeline definition
    await writeFile(
      join(dir, "pipeline.json"),
      JSON.stringify(pipeline, null, 2),
    );

    // Initialize metadata
    const metadata: PipelineMetadata = {
      pipelineId: pipeline.id,
      status: "running",
      startedAt: new Date().toISOString(),
      steps: pipeline.steps.map((step, index) => ({
        index,
        name: step.name,
        status: "pending",
      })),
    };

    await this.writeMetadata(pipeline.id, metadata);
  }

  async updateStep(
    pipelineId: string,
    stepIndex: number,
    update: Partial<StepMetadata>,
  ): Promise<void> {
    const metadata = await this.readMetadata(pipelineId);
    if (!metadata) return;

    metadata.steps[stepIndex] = {
      ...metadata.steps[stepIndex],
      ...update,
    };

    await this.writeMetadata(pipelineId, metadata);
  }

  async saveStepOutput(
    pipelineId: string,
    stepIndex: number,
    output: string,
  ): Promise<void> {
    const dir = this.pipelineDir(pipelineId);
    await writeFile(join(dir, "steps", `${stepIndex}.txt`), output);
  }

  async complete(
    pipelineId: string,
    status: "success" | "failed",
  ): Promise<void> {
    const metadata = await this.readMetadata(pipelineId);
    if (!metadata) return;

    metadata.status = status;
    metadata.completedAt = new Date().toISOString();

    await this.writeMetadata(pipelineId, metadata);
  }

  async getMetadata(pipelineId: string): Promise<PipelineMetadata | null> {
    return this.readMetadata(pipelineId);
  }

  async getStepOutput(pipelineId: string, stepIndex: number): Promise<string | null> {
    const filePath = join(this.pipelineDir(pipelineId), "steps", `${stepIndex}.txt`);
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  private pipelineDir(pipelineId: string): string {
    return join(this.stateDir, pipelineId);
  }

  private metadataPath(pipelineId: string): string {
    return join(this.pipelineDir(pipelineId), "metadata.json");
  }

  private async readMetadata(pipelineId: string): Promise<PipelineMetadata | null> {
    try {
      const raw = await readFile(this.metadataPath(pipelineId), "utf-8");
      return JSON.parse(raw) as PipelineMetadata;
    } catch {
      return null;
    }
  }

  private async writeMetadata(pipelineId: string, metadata: PipelineMetadata): Promise<void> {
    await mkdir(this.pipelineDir(pipelineId), { recursive: true });
    await writeFile(this.metadataPath(pipelineId), JSON.stringify(metadata, null, 2));
  }
}
