export class PipelineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PipelineError";
  }
}

export class StepExecutionError extends PipelineError {
  constructor(
    message: string,
    public readonly stepId: string,
    public readonly stepName: string,
    public readonly exitCode: number,
    public readonly stdout?: string,
    public readonly stderr?: string,
    public readonly attempt?: number,
  ) {
    super(message);
    this.name = "StepExecutionError";
  }
}

export class ParseError extends PipelineError {
  constructor(
    message: string,
    public readonly position?: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export class SkillNotFoundError extends PipelineError {
  constructor(
    public readonly skillName: string,
  ) {
    super(`Skill not found: ${skillName}`);
    this.name = "SkillNotFoundError";
  }
}
