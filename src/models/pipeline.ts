export interface PipelineStep {
  id: string;
  name: string;
  args?: string;
  retry?: number;
  retryDelayMs?: number;
  fallback?: string;
  onError?: "stop" | "skip" | "fallback";
}

export interface Pipeline {
  id: string;
  steps: PipelineStep[];
  input?: string;
  createdAt: number;
}
