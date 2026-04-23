# cc-pipe

A pipe operator for [Claude Code](https://claude.ai/code) skills — bring Unix-style `skill1 | skill2 | skill3` composition to your AI workflow.

```bash
# Chain skills where each one's output feeds into the next
cc-pipe "translate | summarize | format"

# Run parallel branches and merge the results
cc-pipe "analyze | [translate & summarize] | merge | format"

# Route conditionally based on previous output
cc-pipe "fetch | ?{contains 'error'} > handle-error : process | format"

# Retry on failure with a fallback skill
cc-pipe "extract | validate --retry 3 --fallback cleanup | deploy"
```

## Why

Claude Code skills are powerful, but composing them is manual — you run one skill, copy its output, paste it into the next. cc-pipe automates that handoff. It's the `|` operator Claude Code was missing.

**What it enables:**
- Chain any skills or natural-language instructions into a pipeline
- Run skills in parallel and merge results
- Route dynamically based on output content
- Automatic retry, fallback, and error recovery
- Inspect, resume, and replay past pipeline runs

## Install

```bash
git clone https://github.com/Jac0bXu/cc-pipe.git
cd cc-pipe
npm install
npm run build

# Use globally (optional)
npm link
```

Requires Node.js 18+ and [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` on PATH).

## Usage

### CLI

```bash
# Run a pipeline
cc-pipe "skill1 | skill2 | skill3"

# With initial input
echo "Hello world" | cc-pipe "translate | summarize"
cc-pipe run "translate | summarize" --input "Hello world"

# JSON output (for scripting)
cc-pipe "skill1 | skill2" --output-format json

# Verbose mode (step-by-step progress)
cc-pipe "skill1 | skill2" --verbose

# Inspect past runs
cc-pipe list
cc-pipe inspect <pipeline-id>

# Resume a failed pipeline
cc-pipe resume <pipeline-id>

# Re-run a past pipeline
cc-pipe replay <pipeline-id>
cc-pipe replay <pipeline-id> --dry-run
```

### `/pipe` skill (in Claude Code)

cc-pipe installs as a Claude Code skill. Inside any Claude Code session:

```
/pipe "translate | summarize | format"
```

The skill has **two execution modes**:

| Mode | When | How |
|------|------|-----|
| **In-session** | Simple linear pipelines (2-4 steps) | Claude invokes each skill directly via the Skill tool — fast, no subprocess overhead |
| **Subprocess** | Parallel branches, conditionals, long pipelines, retry/fallback | Delegates to `cc-pipe` CLI for full engine support |

Claude picks the right mode automatically based on pipeline complexity.

## DSL Reference

### Linear pipeline

```
skill1 | skill2 | skill3
```

Each skill's text output becomes the next skill's input.

### Parallel branches

```
skill1 | [skill2 & skill3] | skill4
```

Fan-out: `skill1`'s output feeds into both `skill2` and `skill3` concurrently. Their outputs are merged before passing to `skill4`.

Merge strategies (default: `concat`):

```
[skill2 & skill3] --merge json-array    # ["out2", "out3"]
[skill2 & skill3] --merge first         # just skill2's output
[skill2 & skill3] --merge last          # just skill3's output
[skill2 & skill3] --merge concat        # out2\n---\nout3
```

### Conditional routing

```
skill1 | ?{contains 'error'} > error-handler : normal-handler
```

If `skill1`'s output contains "error", run `error-handler`. Otherwise, run `normal-handler`.

Without an else branch, output passes through unchanged:

```
skill1 | ?{contains 'warning'} > handle-warning | skill3
```

**Condition types:**

| Syntax | Description |
|--------|-------------|
| `contains 'text'` | Substring match |
| `matches '/regex/'` | Regex test |
| `equals 'exact'` | Exact string match |
| `exit-code N` | Check previous step's exit code |
| `json-path '$.status equals "error"'` | JSON field comparison |

### Error recovery

Per-step flags for resilience:

```
# Retry up to 3 times on failure
skill1 | skill2 --retry 3 | skill3

# Retry with delay between attempts
skill1 | skill2 --retry 3 --retry-delay 1000 | skill3

# Fall back to another skill if retries exhaust
skill1 | skill2 --retry 2 --fallback cleanup | skill3

# Skip the step on failure (pass input through unchanged)
skill1 | skill2 --on-error skip | skill3
```

### Putting it together

```
fetch | [translate & summarize] --merge json-array | ?{contains 'error'} > handle-error : format | deploy --retry 2 --fallback rollback
```

## How it works

Each pipeline step invokes `claude --print --output-format json`, which produces structured output including the text result, token usage, and cost. cc-pipe:

1. **Parses** the DSL into an AST (linear, parallel, and conditional nodes)
2. **Resolves** each skill name to its SKILL.md (project skills, global skills, or plugin skills). Falls back to treating the name as a natural-language instruction.
3. **Executes** the pipeline — sequentially, in parallel, or conditionally — piping text output between steps
4. **Tracks** metadata (timing, tokens, cost, errors) in a JSON side-channel at `.cc-pipe/<id>/metadata.json`
5. **Persists** intermediate outputs and pipeline state for inspection, resume, and replay

```
User → DSL string → Parser → AST → Runner → [claude --print × N] → Final output
                                              ↕
                                         Metadata channel
                                         (.cc-pipe/)
```

## Project structure

```
src/
  parser/           # Tokenizer + recursive-descent parser → AST
  engine/           # Pipeline runner, step executor, parallel executor,
                    # condition evaluator, skill resolver, metadata channel
  models/           # Types for pipelines, results, and errors
  persistence/      # File-based store for pipeline state
  commands/         # CLI command handlers (run, list, inspect, resume, replay)
.claude/skills/     # /pipe skill definition for in-session use
tests/              # Unit and integration tests (58 tests)
```

## Development

```bash
npm install           # Install dependencies
npm run build         # Build to dist/
npm test              # Run tests
npm run lint          # Type-check
npm run dev -- <dsl>  # Run CLI in dev mode
```

## License

MIT
