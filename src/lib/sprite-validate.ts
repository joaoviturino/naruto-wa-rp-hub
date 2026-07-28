import type { StatesMap, AnimState } from "@/components/AnimatedSprite";

export type SheetValidation = {
  ok: boolean;
  loaded: boolean;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  errors: string[];
  warnings: string[];
};

const dimCache = new Map<string, { w: number; h: number }>();

export function loadImageSize(url: string): Promise<{ w: number; h: number }> {
  const cached = dimCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const v = { w: img.naturalWidth, h: img.naturalHeight };
      dimCache.set(url, v);
      resolve(v);
    };
    img.onerror = () => reject(new Error("Falha ao carregar a spritesheet."));
    img.src = url;
  });
}

/**
 * Valida spritesheet: cols/rows preenchidos, dimensões divisíveis,
 * e cada estado referencia linha/frames dentro dos limites da grade.
 */
export async function validateSpriteSheet(
  sheetUrl: string | null | undefined,
  cols: number | null | undefined,
  rows: number | null | undefined,
  states: StatesMap | null | undefined,
): Promise<SheetValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const out: SheetValidation = {
    ok: false, loaded: false, width: 0, height: 0,
    frameWidth: 0, frameHeight: 0, errors, warnings,
  };
  if (!sheetUrl) {
    errors.push("Nenhuma spritesheet definida.");
    return out;
  }
  if (!cols || cols < 1) errors.push("Colunas (cols) deve ser ≥ 1.");
  if (!rows || rows < 1) errors.push("Linhas (rows) deve ser ≥ 1.");

  try {
    const { w, h } = await loadImageSize(sheetUrl);
    out.loaded = true;
    out.width = w;
    out.height = h;
    if (cols && rows) {
      out.frameWidth = w / cols;
      out.frameHeight = h / rows;
      if (w % cols !== 0) warnings.push(`Largura ${w}px não é divisível por ${cols} colunas (frames sairão desalinhados).`);
      if (h % rows !== 0) warnings.push(`Altura ${h}px não é divisível por ${rows} linhas (frames sairão desalinhados).`);
    }
  } catch (e: any) {
    errors.push(e?.message ?? "Erro ao ler a imagem.");
    return out;
  }

  if (cols && rows && states) {
    for (const [name, cfg] of Object.entries(states) as [AnimState, { row: number; frames: number }][]) {
      if (!cfg) continue;
      if (cfg.row < 0 || cfg.row >= rows) {
        errors.push(`Estado "${name}": linha ${cfg.row} fora da grade (0..${rows - 1}).`);
      }
      if (cfg.frames < 1) {
        errors.push(`Estado "${name}": precisa de pelo menos 1 frame.`);
      } else if (cfg.frames > cols) {
        errors.push(`Estado "${name}": ${cfg.frames} frames excede as ${cols} colunas da grade.`);
      }
    }
  }

  out.ok = errors.length === 0;
  return out;
}