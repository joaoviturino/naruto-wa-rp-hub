import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addWithCapacity } from "@/lib/character.functions";
import { DEFAULT_LEVEL_CONFIG, levelFromXp, type LevelConfig } from "@/lib/level";

const NINJA_BAG_CAP = 20;
const RANKS = ["E", "D", "C", "B", "A", "S"] as const;
const skillRank = z.enum(RANKS);
const NINJA_RANKS = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"] as const;
const ninjaRank = z.enum(NINJA_RANKS);
const requiredProfsSchema = z.array(z.object({
  skill_class: z.string().min(2).max(60),
  nivel: skillRank.nullish(),
  maestria: skillRank.nullish(),
})).default([]);

function rankGte(cur: string | null | undefined, req: string | null | undefined) {
  if (!req) return true;
  const a = NINJA_RANKS.indexOf((cur as any) ?? "estudante");
  const b = NINJA_RANKS.indexOf(req as any);
  return a >= b;
}
function skillRankGte(cur: string | null | undefined, req: string | null | undefined) {
  if (!req) return true;
  const a = RANKS.indexOf((cur as any) ?? "E");
  const b = RANKS.indexOf(req as any);
  return a >= 0 && a >= b;
}
function bookMissingReqs(char: any, book: any, cfg: LevelConfig): string[] {
  const missing: string[] = [];
  const lvl = levelFromXp(char.xp ?? 0, cfg);
  if ((book.required_level ?? 1) > lvl) missing.push(`Nível ${book.required_level}`);
  if (book.required_rank && !rankGte(char.rank, book.required_rank)) missing.push(`Patente ${book.required_rank}`);
  const profs = (char.proficiencies ?? {}) as Record<string, { nivel?: string; maestria?: string }>;
  for (const p of ((book.required_profs as any[]) ?? [])) {
    const cur = profs[p.skill_class] ?? {};
    if (p.nivel && !skillRankGte(cur.nivel, p.nivel)) missing.push(`${p.skill_class} Nível ${p.nivel}`);
    if (p.maestria && !skillRankGte(cur.maestria, p.maestria)) missing.push(`${p.skill_class} Maestria ${p.maestria}`);
  }
  return missing;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function assertAdminOrMod(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_admin_or_mod", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function rankIdx(r: string | null | undefined) {
  if (!r) return -1;
  return RANKS.indexOf(r as any);
}

// ============ Sections ============
const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  description: z.string().max(2000).nullish(),
  cover_url: z.string().nullish(),
  sort_order: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const upsertLibrarySection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => sectionSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("library_sections").upsert(data as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteLibrarySection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("library_sections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Books ============
const rewardsSchema = z.object({
  xp: z.number().int().min(0).max(1_000_000).optional(),
  ryo: z.number().int().min(0).max(10_000_000).optional(),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(99).default(1) })).optional(),
}).default({});

const grantSchema = z.array(z.object({
  skill_class: z.string().min(2).max(60),
  nivel: skillRank.nullable().optional(),
  maestria: skillRank.nullable().optional(),
})).default([]);

const bookSchema = z.object({
  id: z.string().uuid().optional(),
  section_id: z.string().uuid().nullish(),
  title: z.string().min(2).max(120),
  author: z.string().max(80).nullish(),
  cover_url: z.string().nullish(),
  summary: z.string().max(600).nullish(),
  content: z.string().max(60_000).default(""),
  min_read_seconds: z.number().int().min(5).max(3600).default(30),
  rewards: rewardsSchema,
  proficiency_grants: grantSchema,
  sort_order: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
  required_level: z.number().int().min(1).max(1000).default(1),
  required_rank: ninjaRank.nullish(),
  required_profs: requiredProfsSchema,
  blocks: z.array(z.object({
    id: z.string().min(1).max(64),
    kind: z.enum(["text", "image"]),
    text: z.string().max(20_000).nullish(),
    image_url: z.string().nullish(),
  })).default([]),
});

export const upsertLibraryBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => bookSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data as any;
    if (id) {
      const { data: row, error } = await supabaseAdmin.from("library_books").update(rest).eq("id", id).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
    const { data: row, error } = await supabaseAdmin.from("library_books").insert(rest).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteLibraryBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("library_books").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Location <-> Sections ============
export const setLocationLibraries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    section_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("location_libraries").delete().eq("location_id", data.location_id);
    if (data.section_ids.length) {
      const rows = data.section_ids.map((section_id) => ({ location_id: data.location_id, section_id }));
      const { error } = await supabaseAdmin.from("location_libraries").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============ Player-side ============

/** Lista as seções, os livros ativos e quais eu já li. */
export const listLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ location_id: z.string().uuid().nullish() }).default({}).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase.from("characters")
      .select("id,xp,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    const { data: lvlCfg } = await context.supabase.from("level_config").select("*").limit(1).maybeSingle();
    const cfg: LevelConfig = lvlCfg
      ? { base_xp: lvlCfg.base_xp ?? DEFAULT_LEVEL_CONFIG.base_xp, growth_factor: lvlCfg.growth_factor ?? DEFAULT_LEVEL_CONFIG.growth_factor, max_level: lvlCfg.max_level ?? DEFAULT_LEVEL_CONFIG.max_level }
      : DEFAULT_LEVEL_CONFIG;
    const charLevel = char ? levelFromXp(char.xp ?? 0, cfg) : 1;
    let sectionFilterIds: string[] | null = null;
    if (data.location_id) {
      const { data: links } = await context.supabase.from("location_libraries").select("section_id").eq("location_id", data.location_id);
      sectionFilterIds = (links ?? []).map((l: any) => l.section_id);
      if (!sectionFilterIds.length) return { sections: [], books: [], read_ids: [], character_id: char?.id ?? null, character: char ? { id: char.id, xp: char.xp, rank: char.rank, level: charLevel, proficiencies: char.proficiencies ?? {} } : null };
    }
    let sectionsQuery = context.supabase.from("library_sections").select("*").eq("active", true).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (sectionFilterIds) sectionsQuery = sectionsQuery.in("id", sectionFilterIds);
    let booksQuery = context.supabase.from("library_books").select("*").eq("active", true).order("sort_order", { ascending: true }).order("title", { ascending: true });
    if (sectionFilterIds) booksQuery = booksQuery.in("section_id", sectionFilterIds);
    const [{ data: sections }, { data: books }] = await Promise.all([sectionsQuery, booksQuery]);
    let readIds: string[] = [];
    if (char) {
      const { data: reads } = await context.supabase.from("character_book_reads").select("book_id").eq("character_id", char.id);
      readIds = (reads ?? []).map((r: any) => r.book_id);
    }
    const booksWithReqs = (books ?? []).map((b: any) => ({
      ...b,
      missing_requirements: char ? bookMissingReqs(char, b, cfg) : [],
    }));
    return {
      sections: sections ?? [],
      books: booksWithReqs,
      read_ids: readIds,
      character_id: char?.id ?? null,
      character: char ? { id: char.id, xp: char.xp, rank: char.rank, level: charLevel, proficiencies: char.proficiencies ?? {} } : null,
    };
  });

/** Marca o livro como lido e aplica as recompensas (apenas 1x). */
export const completeBookRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ book_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase.from("characters").select("id,xp,ryo,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: book } = await context.supabase.from("library_books").select("*").eq("id", data.book_id).maybeSingle();
    if (!book || !book.active) throw new Error("Livro indisponível.");

    const { data: lvlCfg } = await context.supabase.from("level_config").select("*").limit(1).maybeSingle();
    const cfg: LevelConfig = lvlCfg
      ? { base_xp: lvlCfg.base_xp ?? DEFAULT_LEVEL_CONFIG.base_xp, growth_factor: lvlCfg.growth_factor ?? DEFAULT_LEVEL_CONFIG.growth_factor, max_level: lvlCfg.max_level ?? DEFAULT_LEVEL_CONFIG.max_level }
      : DEFAULT_LEVEL_CONFIG;
    const missing = bookMissingReqs(char, book, cfg);
    if (missing.length) throw new Error("Requisitos não atendidos: " + missing.join(", "));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Já leu? devolve idempotente sem re-aplicar.
    const { data: existing } = await supabaseAdmin.from("character_book_reads")
      .select("id,rewards_applied").eq("character_id", char.id).eq("book_id", data.book_id).maybeSingle();
    if (existing) return { ok: true, alreadyRead: true, rewards: existing.rewards_applied };

    const rewards = (book.rewards ?? {}) as any;
    const grants = (book.proficiency_grants ?? []) as Array<{ skill_class: string; nivel?: string | null; maestria?: string | null }>;
    const applied: any = {};

    const patch: any = {};
    if (rewards.xp) { patch.xp = (char.xp ?? 0) + rewards.xp; applied.xp = rewards.xp; }
    if (rewards.ryo) { patch.ryo = (char.ryo ?? 0) + rewards.ryo; applied.ryo = rewards.ryo; }

    // Proficiências: só sobe se novo rank for maior que o atual.
    if (grants.length) {
      const profs = { ...((char.proficiencies as any) ?? {}) } as Record<string, { nivel?: string | null; maestria?: string | null }>;
      const changed: any[] = [];
      // Limite de elementos por patente — impede bypass via livros.
      const ELEMENT_LIMIT: Record<string, number> = {
        estudante: 1, genin: 1, chunin: 2, tokubetsu_jonin: 3,
        jonin: 4, anbu: 5, sannin: 5, kage: 5,
      };
      const ELS = ["katon","suiton","fuuton","doton","raiton"] as const;
      const rankKey = (char as any).rank as string | null | undefined;
      const limit = ELEMENT_LIMIT[rankKey ?? "estudante"] ?? 1;
      const skippedElements: string[] = [];
      for (const g of grants) {
        const cur = profs[g.skill_class] ?? {};
        const isElement = (ELS as readonly string[]).includes(g.skill_class);
        const wasActive = !!(cur.nivel || cur.maestria);
        if (isElement && !wasActive) {
          const activeCount = ELS.reduce((n, k) => {
            const e = profs[k]; return n + (e && (e.nivel || e.maestria) ? 1 : 0);
          }, 0);
          if (activeCount >= limit) { skippedElements.push(g.skill_class); continue; }
        }
        const nextNivel = rankIdx(g.nivel) > rankIdx(cur.nivel) ? g.nivel : cur.nivel;
        const nextMaestria = rankIdx(g.maestria) > rankIdx(cur.maestria) ? g.maestria : cur.maestria;
        if (nextNivel !== cur.nivel || nextMaestria !== cur.maestria) {
          profs[g.skill_class] = { nivel: nextNivel ?? null, maestria: nextMaestria ?? null };
          changed.push({ skill_class: g.skill_class, nivel: nextNivel, maestria: nextMaestria });
        }
      }
      if (changed.length) { patch.proficiencies = profs; applied.proficiencies = changed; }
      if (skippedElements.length) applied.proficiencies_skipped = { elements: skippedElements, reason: `Limite de ${limit} elemento(s) para patente ${rankKey}` };
    }

    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("characters").update(patch).eq("id", char.id);
      if (error) throw new Error(error.message);
    }

    if (rewards.items?.length) {
      const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle();
      let bag = (((inv?.ninja_bag as any[]) ?? [])
        .filter((e: any) => e && e.item_id)
        .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 })));
      try {
        for (const it of rewards.items as Array<{ item_id: string; qty: number }>) {
          bag = await addWithCapacity(supabaseAdmin, bag, it.item_id, it.qty, NINJA_BAG_CAP);
        }
        await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", char.id);
        applied.items = rewards.items;
      } catch (err: any) {
        applied.items_error = err?.message ?? "Bolsa cheia";
      }
    }

    await supabaseAdmin.from("character_book_reads").insert({
      character_id: char.id, book_id: data.book_id, rewards_applied: applied,
    });

    try {
      const { bumpMissionProgress } = await import("@/lib/missions.functions");
      await bumpMissionProgress(supabaseAdmin, char.id, { type: "read_book", book_id: data.book_id });
    } catch {}

    return { ok: true, rewards: applied };
  });