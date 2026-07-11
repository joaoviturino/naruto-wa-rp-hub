import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addWithCapacity } from "@/lib/character.functions";

const NINJA_BAG_CAP = 20;
const RANKS = ["E", "D", "C", "B", "A", "S"] as const;
const skillRank = z.enum(RANKS);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
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
    await assertAdmin(context);
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
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("library_books").upsert(data as any).select("id").single();
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

// ============ Player-side ============

/** Lista as seções, os livros ativos e quais eu já li. */
export const listLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase.from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    const [{ data: sections }, { data: books }] = await Promise.all([
      context.supabase.from("library_sections").select("*").eq("active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
      context.supabase.from("library_books").select("*").eq("active", true).order("sort_order", { ascending: true }).order("title", { ascending: true }),
    ]);
    let readIds: string[] = [];
    if (char) {
      const { data: reads } = await context.supabase.from("character_book_reads").select("book_id").eq("character_id", char.id);
      readIds = (reads ?? []).map((r: any) => r.book_id);
    }
    return { sections: sections ?? [], books: books ?? [], read_ids: readIds, character_id: char?.id ?? null };
  });

/** Marca o livro como lido e aplica as recompensas (apenas 1x). */
export const completeBookRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ book_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase.from("characters").select("id,xp,ryo,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: book } = await context.supabase.from("library_books").select("*").eq("id", data.book_id).maybeSingle();
    if (!book || !book.active) throw new Error("Livro indisponível.");

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
      for (const g of grants) {
        const cur = profs[g.skill_class] ?? {};
        const nextNivel = rankIdx(g.nivel) > rankIdx(cur.nivel) ? g.nivel : cur.nivel;
        const nextMaestria = rankIdx(g.maestria) > rankIdx(cur.maestria) ? g.maestria : cur.maestria;
        if (nextNivel !== cur.nivel || nextMaestria !== cur.maestria) {
          profs[g.skill_class] = { nivel: nextNivel ?? null, maestria: nextMaestria ?? null };
          changed.push({ skill_class: g.skill_class, nivel: nextNivel, maestria: nextMaestria });
        }
      }
      if (changed.length) { patch.proficiencies = profs; applied.proficiencies = changed; }
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

    return { ok: true, rewards: applied };
  });