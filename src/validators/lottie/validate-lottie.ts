import path from "node:path";
import type { HarnessRequest, ValidationResult } from "../../types.js";
import { pathExists, readText } from "../../utils/fs.js";

export interface LottieDocument {
  v?: string;
  fr?: number;
  ip?: number;
  op?: number;
  w?: number;
  h?: number;
  nm?: string;
  assets?: Array<Record<string, unknown>>;
  layers?: Array<Record<string, unknown>>;
}

export async function runLottieValidators(outputDir: string, request: HarnessRequest): Promise<ValidationResult[]> {
  const animationPath = path.join(outputDir, "animation.json");
  const controlsPath = path.join(outputDir, "controls.json");
  const previewHtmlPath = path.join(outputDir, "preview.html");
  const previewSvgPath = path.join(outputDir, "preview.svg");
  let document: LottieDocument | undefined;
  let controls: Record<string, unknown> = {};

  const validJson = await parseJson<LottieDocument>(animationPath);
  if (validJson.ok) {
    document = validJson.value;
  }
  const controlsJson = await parseJson<Record<string, unknown>>(controlsPath);
  if (controlsJson.ok) {
    controls = controlsJson.value;
  }

  const results: ValidationResult[] = [
    result("valid_json", "Valid JSON", validJson.ok ? "pass" : "fail", validJson.ok ? "animation.json parsed." : validJson.error, [animationPath], true),
    validateSchema(document, animationPath),
    validateFps(document, request, animationPath),
    validateDuration(document, request, animationPath),
    validateDimensions(document, request, animationPath),
    validateControls(controls, request, controlsPath),
    await validateImages(document, outputDir, animationPath),
    validateUnsupportedFeatures(document, animationPath),
    await validatePreview(previewHtmlPath, previewSvgPath),
  ];
  return results;
}

async function parseJson<T>(file: string): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: JSON.parse(await readText(file)) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function validateSchema(document: LottieDocument | undefined, file: string): ValidationResult {
  const ok = Boolean(document?.v && typeof document.fr === "number" && typeof document.ip === "number" && typeof document.op === "number" && typeof document.w === "number" && typeof document.h === "number" && Array.isArray(document.layers));
  return result("valid_lottie_schema", "Basic Lottie schema", ok ? "pass" : "fail", "Required Lottie fields: v, fr, ip, op, w, h, layers.", [file], true);
}

function validateFps(document: LottieDocument | undefined, request: HarnessRequest, file: string): ValidationResult {
  const expected = request.fps ?? 30;
  const actual = document?.fr;
  const ok = typeof actual === "number" && actual > 0 && expected > 0 && actual === expected;
  return result("fps_matches_request", "FPS matches request", ok ? "pass" : "fail", `Expected positive ${expected} FPS, got ${actual ?? "missing"}.`, [file], true);
}

function validateDuration(document: LottieDocument | undefined, request: HarnessRequest, file: string): ValidationResult {
  const expected = request.durationSeconds ?? 4;
  const actual = document && typeof document.fr === "number" && typeof document.ip === "number" && typeof document.op === "number" ? (document.op - document.ip) / document.fr : undefined;
  const ok = actual !== undefined && Number.isFinite(actual) && actual > 0 && expected > 0 && Math.abs(actual - expected) < 0.001;
  return result("duration_matches_request", "Duration matches request", ok ? "pass" : "fail", `Expected positive ${expected}s, got ${actual ?? "missing"}s.`, [file], true);
}

function validateDimensions(document: LottieDocument | undefined, request: HarnessRequest, file: string): ValidationResult {
  const actualWidth = document?.w;
  const actualHeight = document?.h;
  const hasPositiveDimensions = typeof actualWidth === "number" && actualWidth > 0 && typeof actualHeight === "number" && actualHeight > 0;
  const requestedWidthOk = request.width === undefined || actualWidth === request.width;
  const requestedHeightOk = request.height === undefined || actualHeight === request.height;
  const ok = hasPositiveDimensions && requestedWidthOk && requestedHeightOk;
  const expected = request.width !== undefined || request.height !== undefined ? `${request.width ?? "any"}x${request.height ?? "any"}` : "positive dimensions";
  return result("dimensions_match_request", "Dimensions match request", ok ? "pass" : "fail", `Expected ${expected}, got ${actualWidth ?? "?"}x${actualHeight ?? "?"}.`, [file], true);
}

function validateControls(controls: Record<string, unknown>, request: HarnessRequest, file: string): ValidationResult {
  const requested = request.controls.length ? request.controls : ["background", "accentColor", "speed", "cameraIntensity"];
  const missing = requested.filter((control) => !(control in controls));
  return result("controls_exist", "Requested controls exist", missing.length === 0 ? "pass" : "fail", missing.length ? `Missing controls: ${missing.join(", ")}.` : "All requested controls exist.", [file], true);
}

async function validateImages(document: LottieDocument | undefined, outputDir: string, file: string): Promise<ValidationResult> {
  const assets = document?.assets ?? [];
  const referencedImages = assets.filter((asset) => asset.e !== 1 && typeof asset.p === "string" && typeof asset.u === "string");
  const missing: Array<Record<string, unknown>> = [];
  for (const asset of referencedImages) {
    const imagePath = path.join(outputDir, String(asset.u), String(asset.p));
    if (!(await pathExists(imagePath))) {
      missing.push(asset);
    }
  }
  return result("no_missing_image_references", "No missing image references", missing.length === 0 ? "pass" : "fail", missing.length ? `Missing ${missing.length} image asset(s).` : "No external image references are missing.", [file], true);
}

async function validatePreview(previewHtmlPath: string, previewSvgPath: string): Promise<ValidationResult> {
  const htmlExists = await pathExists(previewHtmlPath);
  const svgExists = await pathExists(previewSvgPath);
  const html = htmlExists ? await readText(previewHtmlPath) : "";
  const rendersAnimation = html.includes("lottie.loadAnimation") && html.includes("animation-data");
  const ok = htmlExists && svgExists && rendersAnimation;
  return result(
    "preview_generated",
    "Preview generated",
    ok ? "pass" : "fail",
    ok ? "Preview HTML renders embedded animation data with a static SVG fallback." : "Preview must include HTML, fallback SVG, and Lottie animation wiring.",
    [previewHtmlPath, previewSvgPath],
    true,
  );
}

function validateUnsupportedFeatures(document: LottieDocument | undefined, file: string): ValidationResult {
  const unsupported = findUnsupportedFeatures(document);
  return result("no_unsupported_lottie_features", "No unsupported features", unsupported.length === 0 ? "pass" : "warning", unsupported.length ? `Potential unsupported features: ${unsupported.join(", ")}.` : "No unsupported feature markers found.", [file], true);
}

function findUnsupportedFeatures(value: unknown): string[] {
  const found = new Set<string>();
  function visit(node: unknown): void {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const record = node as Record<string, unknown>;
    if ("x" in record) found.add("expressions");
    if ("ef" in record) found.add("effects");
    for (const child of Object.values(record)) {
      visit(child);
    }
  }
  visit(value);
  return [...found];
}

function result(id: string, name: string, status: ValidationResult["status"], details: string, evidence: string[], repairable: boolean): ValidationResult {
  return { id, name, status, details, evidence, repairable };
}
