import type { Condition } from "../parser/ast-types.js";
import type { StepResult } from "../models/result.js";

export function evaluateCondition(
  condition: Condition,
  input: string,
  lastResult?: StepResult,
): boolean {
  switch (condition.type) {
    case "contains":
      return input.includes(condition.value);

    case "matches": {
      const regexStr = condition.value;
      const match = regexStr.match(/^\/(.+)\/([gimsuy]*)$/);
      if (match) {
        const regex = new RegExp(match[1], match[2]);
        return regex.test(input);
      }
      return new RegExp(regexStr).test(input);
    }

    case "equals":
      return input.trim() === condition.value.trim();

    case "exit-code":
      if (lastResult) {
        return lastResult.exitCode === parseInt(condition.value, 10);
      }
      return false;

    case "json-path": {
      // Parse: "$.field equals 'value'" or "$.field"
      const parts = condition.value.split(/\s+/);
      if (parts.length < 1) return false;

      try {
        const json = JSON.parse(input);
        const path = parts[0];
        const value = resolveJsonPath(json, path);

        // If there's a comparison: "$.field equals 'value'"
        if (parts.length >= 3 && parts[1] === "equals") {
          const expected = parts.slice(2).join(" ").replace(/^['"]|['"]$/g, "");
          return String(value) === expected;
        }

        // Just check if path exists and is truthy
        return !!value;
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

function resolveJsonPath(obj: unknown, path: string): unknown {
  if (!path.startsWith("$") || obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.slice(path.startsWith("$.") ? 2 : 1).split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
