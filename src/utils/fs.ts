import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function readText(target: string): Promise<string> {
  return readFile(target, "utf8");
}

export async function readTextIfExists(target: string): Promise<string | undefined> {
  if (!(await pathExists(target))) {
    return undefined;
  }
  return readText(target);
}

export async function writeJson(target: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(target));
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(target: string): Promise<T> {
  return JSON.parse(await readText(target)) as T;
}

export async function writeText(target: string, value: string): Promise<void> {
  await ensureDir(path.dirname(target));
  await writeFile(target, value, "utf8");
}

export async function listFiles(root: string, maxFiles = 200): Promise<string[]> {
  const result: string[] = [];
  async function visit(current: string): Promise<void> {
    if (result.length >= maxFiles) {
      return;
    }
    const info = await stat(current);
    if (info.isFile()) {
      result.push(current);
      return;
    }
    if (!info.isDirectory()) {
      return;
    }
    const entries = await readdir(current);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === "output") {
        continue;
      }
      await visit(path.join(current, entry));
      if (result.length >= maxFiles) {
        break;
      }
    }
  }
  if (await pathExists(root)) {
    await visit(root);
  }
  return result;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "harness-run";
}

export function stableId(prefix: string, value: string): string {
  const hash = createHash("sha1").update(value).digest("hex").slice(0, 8);
  return `${prefix}-${hash}`;
}

export function relativeFromCwd(target: string): string {
  return path.relative(process.cwd(), target) || ".";
}
