export interface StepResult {
  stepId: string;
  stepName: string;
  output: string;
  exitCode: number;
  durationMs: number;
  timestamp: number;
  tokenUsage?: { input: number; output: number };
  costUsd?: number;
  sessionId?: string;
  error?: string;
  retryAttempts?: number;
  fallbackUsed?: boolean;
}

export interface PipelineResult {
  pipelineId: string;
  results: StepResult[];
  totalDurationMs: number;
  status: "success" | "failed";
  finalOutput: string;
}

export interface PipelineMetadata {
  pipelineId: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  steps: StepMetadata[];
}

export interface StepMetadata {
  index: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokenUsage?: { input: number; output: number };
  costUsd?: number;
  sessionId?: string;
  error?: string;
  retryAttempts?: number;
  fallbackUsed?: boolean;
}
