import { readTextIfExists } from "../utils/fs.js";

export interface SvgProfile {
  location: string;
  width?: number;
  height?: number;
  viewBox?: string;
  colors: string[];
  groupCount: number;
  pathCount: number;
}

export async function profileSvg(location: string): Promise<SvgProfile | undefined> {
  const text = await readTextIfExists(location);
  if (!text) {
    return undefined;
  }
  const width = numberAttr(text, "width");
  const height = numberAttr(text, "height");
  const viewBox = text.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  const colors = [...new Set([...text.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0].toLowerCase()))];
  return {
    location,
    width,
    height,
    viewBox,
    colors,
    groupCount: (text.match(/<g\b/gi) ?? []).length,
    pathCount: (text.match(/<path\b/gi) ?? []).length,
  };
}

function numberAttr(text: string, attr: string): number | undefined {
  const value = text.match(new RegExp(`\\b${attr}=["']([0-9.]+)`, "i"))?.[1];
  return value ? Number(value) : undefined;
}
