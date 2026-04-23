export type ASTNodeType = "skill" | "parallel" | "conditional";

export type MergeStrategy = "concat" | "json-array" | "first" | "last";

export interface SkillStepNode {
  type: "skill";
  name: string;
  args?: string;
  flags: StepFlags;
}

export interface StepFlags {
  retry?: number;
  retryDelayMs?: number;
  fallback?: string;
  onError?: "stop" | "skip" | "fallback";
}

export interface ParallelGroupNode {
  type: "parallel";
  steps: SkillStepNode[];
  mergeStrategy?: MergeStrategy;
}

export interface ConditionalNode {
  type: "conditional";
  condition: Condition;
  thenStep: SkillStepNode | ParallelGroupNode;
  elseStep?: SkillStepNode | ParallelGroupNode;
}

export interface Condition {
  type: "contains" | "matches" | "equals" | "exit-code" | "json-path";
  value: string;
}

export type PipelineASTNode = SkillStepNode | ParallelGroupNode | ConditionalNode;

export interface PipelineAST {
  steps: PipelineASTNode[];
}
