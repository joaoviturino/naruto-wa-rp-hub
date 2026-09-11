import type { StatesMap, StateConfig } from "@/lib/sprite-animation";

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

const pending = new Map<string, Promise<{ w: number; h: number }>>();
export function loadImageSize(url: string): Promise<{ w: number; h: number }> {
  const cached = dimCache.get(url);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(url);
  if (running) return running;
  const request = new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => finish(new Error("Tempo esgotado ao carregar a imagem.")), 12_000);
    function finish(error?: Error) {
      clearTimeout(timeout); img.onload = null; img.onerror = null;
      if (error) return reject(error);
      const value = { w: img.naturalWidth, h: img.naturalHeight };
      if (!value.w || !value.h) return reject(new Error("A imagem não possui dimensões válidas."));
      dimCache.set(url, value);
      if (dimCache.size > 200) dimCache.delete(dimCache.keys().next().value!);
      resolve(value);
    }
    img.onload = () => finish();
    img.onerror = () => finish(new Error("Falha ao carregar a imagem."));
    img.src = url;
  }).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
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
  if (!cols || !Number.isInteger(cols) || cols < 1 || cols > 64) errors.push("Colunas deve ser um inteiro entre 1 e 64.");
  if (!rows || !Number.isInteger(rows) || rows < 1 || rows > 64) errors.push("Linhas deve ser um inteiro entre 1 e 64.");

  try {
    const { w, h } = await loadImageSize(sheetUrl);
    out.loaded = true;
    out.width = w;
    out.height = h;
    if (cols && rows) {
      out.frameWidth = w / cols;
      out.frameHeight = h / rows;
      if (w % cols !== 0) errors.push(`Largura ${w}px não é divisível por ${cols} colunas (frames sairão desalinhados).`);
      if (h % rows !== 0) errors.push(`Altura ${h}px não é divisível por ${rows} linhas (frames sairão desalinhados).`);
    }
  } catch (e: any) {
    errors.push(e?.message ?? "Erro ao ler a imagem.");
    return out;
  }

  if (cols && rows && states) {
    for (const [name, cfg] of Object.entries(states) as [string, StateConfig][]) {
      if (!cfg) continue;
      if (cfg.fps !== undefined && (!Number.isFinite(cfg.fps) || cfg.fps < 1 || cfg.fps > 60)) {
        errors.push(`Estado "${name}": FPS deve estar entre 1 e 60.`);
      }
      if (!Number.isInteger(cfg.row) || cfg.row < 0 || cfg.row >= rows) {
        errors.push(`Estado "${name}": linha ${cfg.row} fora da grade (0..${rows - 1}).`);
      }
      if (!Number.isInteger(cfg.frames) || cfg.frames < 1) {
        errors.push(`Estado "${name}": precisa de pelo menos 1 frame.`);
      } else if (cfg.frames > cols) {
        errors.push(`Estado "${name}": ${cfg.frames} frames excede as ${cols} colunas da grade.`);
      }
    }
  }

  if (!states?.idle) warnings.push("Defina um estado parado (idle) para a pose de descanso.");
  out.ok = errors.length === 0;
  return out;
}
