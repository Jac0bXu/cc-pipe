import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { cwd } from "node:process";
import { SkillNotFoundError } from "../models/errors.js";

export interface ResolvedSkill {
  type: "skill" | "prompt";
  name: string;
  path?: string;
}

const SKILL_SEARCH_PATHS = [
  // Project skills
  () => join(cwd(), ".claude", "skills"),
  // Global skills
  () => join(homedir(), ".claude", "skills"),
];

async function findSkillInDir(skillName: string, dir: string): Promise<string | null> {
  const skillFile = join(dir, skillName, "SKILL.md");
  try {
    await access(skillFile);
    return skillFile;
  } catch {
    return null;
  }
}

async function findPluginSkill(skillName: string): Promise<string | null> {
  const pluginCacheDir = join(homedir(), ".claude", "plugins", "cache");
  try {
    const entries = await readdir(pluginCacheDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(pluginCacheDir, entry.name, "skills", skillName, "SKILL.md");
      try {
        await access(skillFile);
        return skillFile;
      } catch {
        continue;
      }
    }
  } catch {
    // Plugin cache dir doesn't exist, that's fine
  }
  return null;
}

export async function resolveSkill(skillName: string): Promise<ResolvedSkill> {
  // Check standard skill paths
  for (const getDir of SKILL_SEARCH_PATHS) {
    const dir = getDir();
    const path = await findSkillInDir(skillName, dir);
    if (path) {
      return { type: "skill", name: skillName, path };
    }
  }

  // Check plugin skills
  const pluginPath = await findPluginSkill(skillName);
  if (pluginPath) {
    return { type: "skill", name: skillName, path: pluginPath };
  }

  // Fall back to treating as a raw prompt instruction
  return { type: "prompt", name: skillName };
}
