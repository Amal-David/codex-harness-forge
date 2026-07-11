import path from "node:path";
import { listFiles, readText } from "../utils/fs.js";

export interface ComponentInventory {
  components: Array<{ name: string; importPath: string; sourceFile: string }>;
  tokens: string[];
  rawColors: Array<{ file: string; value: string }>;
  importIssues: Array<{ file: string; importPath: string; reason: string }>;
}

export async function inventoryDesignSystem(sourceDirs: string[]): Promise<ComponentInventory> {
  const files = (await Promise.all(sourceDirs.map((source) => listFiles(source, 500)))).flat();
  const components = [];
  const tokenSet = new Set<string>();
  const rawColors: Array<{ file: string; value: string }> = [];
  const importIssues: Array<{ file: string; importPath: string; reason: string }> = [];

  for (const file of files.filter((candidate) => /\.(tsx?|jsx?|css|scss)$/i.test(candidate))) {
    const text = await readText(file).catch(() => "");
    for (const name of componentExports(text)) {
      components.push({ name, importPath: inferImportPath(sourceDirs, file, name), sourceFile: file });
    }
    for (const marker of tokenMarkers(file, text)) {
      tokenSet.add(marker);
    }
    for (const line of text.split("\n")) {
      const definesToken = /^\s*--[a-z0-9-]+\s*:/i.test(line);
      if (definesToken) {
        continue;
      }
      for (const match of line.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
        rawColors.push({ file, value: match[0] });
      }
    }
    for (const match of text.matchAll(/import\s+[^"']*["'](\.[^"']+)["']/g)) {
      const importPath = match[1] ?? "";
      if (!couldResolveRelativeImport(file, importPath, files)) {
        importIssues.push({ file, importPath, reason: "Relative import target was not found in profiled files." });
      }
    }
  }

  return {
    components,
    tokens: [...tokenSet],
    rawColors,
    importIssues,
  };
}

function inferImportPath(sourceDirs: string[], file: string, name: string): string {
  const root = sourceDirs.find((source) => file.startsWith(source)) ?? path.dirname(file);
  const withoutExt = path.relative(root, file).replace(/\.[cm]?[tj]sx?$/, "");
  return `./${withoutExt}#${name}`;
}

function couldResolveRelativeImport(file: string, importPath: string, profiledFiles: string[]): boolean {
  const base = stripExtension(path.resolve(path.dirname(file), importPath));
  return profiledFiles.some((candidate) => {
    const normalized = stripExtension(path.resolve(candidate));
    return normalized === base || path.resolve(candidate) === path.resolve(path.dirname(file), importPath);
  });
}

function componentExports(text: string): string[] {
  const names = [...text.matchAll(/export\s+(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? "");
  for (const match of text.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) {
    const nearby = text.slice(match.index ?? 0, (match.index ?? 0) + 300);
    if (/=>\s*(?:<|\(|React\.)|React\.(?:memo|forwardRef|createElement)/.test(nearby)) {
      names.push(match[1] ?? "");
    }
  }
  return names.filter(Boolean);
}

function tokenMarkers(file: string, text: string): string[] {
  const markers: string[] = [];
  if (/\.(css|scss)$/i.test(file)) {
    markers.push(...[...text.matchAll(/(?:--[a-z0-9-]+|var\(--[a-z0-9-]+\))/gi)].map((match) => match[0]));
  }
  markers.push(
    ...[...text.matchAll(/tokens\.(?!length\b|add\b|map\b|filter\b|reduce\b|forEach\b|size\b)[A-Za-z0-9_.-]+/g)].map((match) => match[0]),
  );
  return markers;
}

function stripExtension(value: string): string {
  return value.replace(/\.(?:[cm]?[tj]sx?|jsx?|css|scss|js)$/, "");
}
