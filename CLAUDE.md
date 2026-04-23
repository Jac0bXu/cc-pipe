# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

cc-pipe is a pipe operator for Claude Code skills — bringing Unix-style `skill1 | skill2 | skill3` composition to the skill system. The output of one skill becomes the input/arguments of the next, enabling composable pipelines without manual orchestration. Primary usage is through the `/pipe` skill for LLM-driven orchestration.

## Commands

```bash
npm run build       # Build with tsup → dist/
npm run dev         # Run CLI via tsx (dev mode)
npm test            # Run vitest tests
npm run test:watch  # Run tests in watch mode
npm run lint        # Type-check with tsc --noEmit
```

Running a single test file:
```bash
npx vitest run tests/parser/parser.test.ts
```

## Architecture

```
src/
  cli.ts                     # Commander CLI entry point
  index.ts                   # Public API exports
  parser/
    pipeline-lexer.ts        # Tokenizer → Token[]
    pipeline-parser.ts       # Recursive-descent parser → PipelineAST
    ast-types.ts             # AST node types (SkillStep, Parallel, Conditional)
  engine/
    pipeline-runner.ts       # Orchestrates execution with retry/fallback/parallel/conditional
    step-executor.ts         # Executes single step via `claude --print --output-format json`
    skill-resolver.ts        # Resolves skill names → SKILL.md paths (project/global/plugin)
    parallel-executor.ts     # Concurrent step execution with merge strategies
    condition-evaluator.ts   # Evaluates routing conditions (contains, matches, etc.)
    metadata-channel.ts      # JSON side-channel → .cc-pipe/<id>/metadata.json
  models/
    pipeline.ts              # Pipeline, PipelineStep types
    result.ts                # StepResult, PipelineResult, metadata types
    errors.ts                # ParseError, StepExecutionError, SkillNotFoundError
  persistence/
    store.ts                 # FileStore — CRUD for .cc-pipe/ directory
  commands/
    run.ts                   # cc-pipe run <dsl>
    resume.ts                # cc-pipe resume <id> [--from-step N]
    replay.ts                # cc-pipe replay <id> [--dry-run]
    inspect.ts               # cc-pipe inspect <id>
    list.ts                  # cc-pipe list
.claude/skills/pipe/SKILL.md  # Claude Code skill wrapper (two execution modes)
```

**Key flow**: CLI or /pipe skill → parse DSL → resolve skills → execute (sequential/parallel/conditional) via `claude --print` → pipe text output between steps → track metadata in JSON side-channel → persist to `.cc-pipe/`.

**Two execution modes**: (1) In-session: Claude invokes skills directly via Skill tool for simple linear pipelines. (2) Subprocess: spawns `claude --print` per step for parallel branches, conditional routing, and long pipelines. The `/pipe` skill's SKILL.md tells Claude which mode to use.

**Skill invocation**: Each step runs `claude --print --output-format json` with a prompt that references the skill name. If the skill has a SKILL.md, Claude uses it; otherwise the name is treated as a raw prompt instruction.

## DSL Syntax

```
# Linear
skill1 | skill2 | skill3

# With error recovery flags
skill1 --retry 3 --fallback cleanup | skill2 --on-error skip

# Parallel fan-out/fan-in
skill1 | [skill2 & skill3] --merge json-array | skill4

# Conditional routing
skill1 | ?{contains 'error'} > error-handler : normal-handler

# Mixed
fetch | [translate & summarize] | ?{contains 'error'} > handle-error : format
```

### Condition types
- `contains 'text'` — substring match
- `matches '/regex/'` — regex test
- `equals 'exact'` — exact string match (trimmed)
- `exit-code N` — check previous step's exit code
- `json-path '$.field equals "value"'` — JSON field comparison

### Merge strategies
- `concat` (default) — join with `\n\n---\n\n` separator
- `json-array` — wrap in JSON array
- `first` — take first result only
- `last` — take last result only
