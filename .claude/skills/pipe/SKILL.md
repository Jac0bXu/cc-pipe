---
name: pipe
description: Chain multiple skills in a pipeline where each skill's output feeds into the next skill's input. Use when you need to compose skills sequentially, in parallel, or conditionally.
---

# Pipe Skill

Chain Claude Code skills together in a pipeline. Each skill's output becomes the next skill's input.

## When to Use

- When the user wants to run multiple skills in sequence (e.g., "translate then summarize then format")
- When the user uses pipe-like language: "pipe X into Y", "chain X and Y", "run X then Y"
- When the user explicitly invokes `/pipe`

## Pipeline DSL

The DSL syntax supports:

```
# Linear pipeline
skill1 | skill2 | skill3

# Parallel fan-out/fan-in
skill1 | [skill2 & skill3] | skill4

# Conditional routing
skill1 | ?{contains 'error'} > error-handler : normal-handler

# With error recovery flags
skill1 | skill2 --retry 3 --fallback cleanup | skill3

# Mixed
fetch | [translate & summarize] --merge json-array | ?{contains 'error'} > handle-error : format
```

## Execution Modes

You have TWO modes for executing pipelines. Choose based on the pipeline complexity:

### Mode 1: In-Session Orchestration (preferred for simple linear pipelines)

For linear pipelines of 2-4 skills with no parallel branches or complex conditionals, execute the pipeline yourself by invoking each skill sequentially using the Skill tool:

1. Parse the pipeline DSL from $ARGUMENTS
2. Invoke the first skill via the Skill tool, passing any initial input as arguments
3. Take the text output from that skill
4. Invoke the next skill via the Skill tool, passing the previous output as arguments
5. Repeat until all skills have been invoked
6. Present the final output to the user

**Example**: For `/pipe "translate | summarize | format"`:
- Call Skill tool with skill="translate", args="$ARGUMENTS or user's input"
- Take the translation output
- Call Skill tool with skill="summarize", args="<translation output>"
- Take the summary output
- Call Skill tool with skill="format", args="<summary output>"
- Present the formatted result

**Important**: In this mode, each skill invocation uses the Skill tool. The output you receive from each skill is what you pass as arguments to the next skill.

### Mode 2: Subprocess Mode (for complex pipelines)

For pipelines with parallel branches, conditional routing, or when isolation is needed, delegate to the `cc-pipe` CLI:

```bash
cc-pipe run "$ARGUMENTS" --output-format json --verbose
```

Use this mode when:
- The pipeline contains `[skill1 & skill2]` parallel branches
- The pipeline contains `?{condition} > then : else` conditional routing
- The pipeline has more than 4 steps
- The user requests isolation between steps
- Error recovery with `--retry` or `--fallback` is needed

Parse the JSON result and present:
- Pipeline status (success/failed)
- Each step's output (summarized if long)
- Total timing
- Any errors or warnings

## Inspecting Past Runs

```bash
cc-pipe list                       # List past pipeline runs
cc-pipe inspect <pipeline-id>      # Show details of a run
cc-pipe resume <pipeline-id>       # Resume a failed pipeline
cc-pipe replay <pipeline-id>       # Re-run a past pipeline
```

## Decision Guide

| Pipeline type | Mode | Why |
|---|---|---|
| `a \| b` | In-session | Fast, no subprocess overhead |
| `a \| b \| c` | In-session | Still fast, 3 sequential calls |
| `a \| [b & c] \| d` | Subprocess | Parallel needs separate processes |
| `a \| ?{...} > b : c` | Subprocess | Conditional routing needs evaluator |
| `a \| b --retry 3` | Subprocess | Retry logic needs error handling |
| `a \| b \| c \| d \| e` | Subprocess | Long pipelines benefit from isolation |
