import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StarterItem = {
  name: string;
  type: "armor_vest" | "weapon" | "consumable";
  slot_size: number;
  description: string;
  qty: number;
  meta?: any;
};

const STARTER_ITEMS: StarterItem[] = [
  {
    name: "Colete de Treinamento",
    type: "armor_vest",
    slot_size: 2,
    description: "Colete leve entregue pelo Sensei Hikaru. Perfeito para os primeiros combates.",
    qty: 1,
  },
  {
    name: "Kunai de Treino",
    type: "weapon",
    slot_size: 1,
    description: "Uma kunai gasta, mas ainda afiada o bastante para uma batalha de treino.",
    qty: 3,
  },
  {
    name: "Ração de Soldado",
    type: "consumable",
    slot_size: 1,
    description: "Restaura um pouco de vida em campo. Sabor duvidoso, eficácia comprovada.",
    qty: 2,
    meta: { restore: { pool: "all", mode: "percent", amount: 50 } },
  },
];

const STARTER_XP = 1000;

/** Concede o kit inicial de tutorial + 1000 XP (idempotente por tutorial_state.kit_granted). */
export const grantStarterKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check
    const { data: char, error: cerr } = await supabase
      .from("characters")
      .select("id,user_id,xp,tutorial_state")
      .eq("id", data.character_id)
      .maybeSingle();
    if (cerr) throw new Error(cerr.message);
    if (!char || char.user_id !== userId) throw new Error("Personagem inválido.");

    const tstate = (char as any).tutorial_state ?? {};
    if (tstate.kit_granted) {
      return { granted: false, already: true, items: STARTER_ITEMS.map((i) => i.name) };
    }

    // Garante linha de inventário
    const { data: inv } = await supabase
      .from("inventory")
      .select("character_id,ninja_bag")
      .eq("character_id", data.character_id)
      .maybeSingle();
    if (!inv) {
      await supabase.from("inventory").insert({ character_id: data.character_id });
    }

    // Upsert dos items pelo nome (via admin — a tabela items só permite escrita de admin)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const names = STARTER_ITEMS.map((i) => i.name);
    const { data: existing } = await supabase.from("items").select("id,name").in("name", names);
    const byName = new Map((existing ?? []).map((r: any) => [r.name, r.id as string]));
    const missing = STARTER_ITEMS.filter((i) => !byName.has(i.name)).map((i) => ({
      name: i.name,
      type: i.type,
      slot_size: i.slot_size,
      description: i.description,
      meta: i.meta ?? null,
    }));
    if (missing.length) {
      const { data: inserted, error: ierr } = await supabaseAdmin
        .from("items")
        .insert(missing)
        .select("id,name");
      if (ierr) throw new Error(ierr.message);
      for (const row of inserted ?? []) byName.set(row.name, row.id as string);
    }
    // Garante que a ração existente tenha meta.restore (para restauro funcionar em contas antigas)
    const rationId = byName.get("Ração de Soldado");
    if (rationId) {
      await supabaseAdmin.from("items").update({ meta: { restore: { pool: "all", mode: "percent", amount: 50 } } }).eq("id", rationId);
    }

    // Adiciona na ninja_bag (respeita items já existentes; empilha consumíveis)
    const bagRaw = Array.isArray(inv?.ninja_bag) ? (inv!.ninja_bag as any[]) : [];
    const bag = bagRaw
      .filter((e) => e && e.item_id)
      .map((e) => ({ item_id: e.item_id as string, qty: Math.max(1, Number(e.qty) || 1) }));

    for (const starter of STARTER_ITEMS) {
      const itemId = byName.get(starter.name);
      if (!itemId) continue;
      const already = bag.some((e) => e.item_id === itemId);
      if (already) continue; // idempotente: não empilha nem repõe
      bag.push({ item_id: itemId, qty: starter.qty });
    }

    const { error: uerr } = await supabase
      .from("inventory")
      .update({ ninja_bag: bag })
      .eq("character_id", data.character_id);
    if (uerr) throw new Error(uerr.message);

    // XP + marca no tutorial_state
    const newXp = (Number((char as any).xp) || 0) + STARTER_XP;
    const nextState = { ...tstate, kit_granted: true, kit_granted_at: new Date().toISOString() };
    await supabase
      .from("characters")
      .update({ xp: newXp, tutorial_state: nextState })
      .eq("id", data.character_id);

    return { granted: true, items: STARTER_ITEMS.map((i) => i.name), xp_gained: STARTER_XP };
  });

/** Retorna o estado do tutorial + dados úteis para a UI (id da ração, se o colete está equipado, sessão de combate ativa). */
export const getTutorialProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: char } = await supabase
      .from("characters")
      .select("id,user_id,tutorial_state,tutorial_completed,current_location_id")
      .eq("id", data.character_id).maybeSingle();
    if (!char || char.user_id !== userId) throw new Error("Personagem inválido.");
    const { data: inv } = await supabase
      .from("inventory").select("vest_id,ninja_bag,secondary_slots").eq("character_id", data.character_id).maybeSingle();
    const { data: ration } = await supabase
      .from("items").select("id").eq("name", "Ração de Soldado").maybeSingle();
    const bag = [...(Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag as any[] : []),
                 ...(Array.isArray(inv?.secondary_slots) ? inv!.secondary_slots as any[] : [])];
    const rationId = (ration as any)?.id ?? null;
    const hasRation = rationId ? bag.some((e: any) => e?.item_id === rationId) : false;
    // Combate ativo?
    const { data: parts } = await supabase.from("combat_participants").select("session_id").eq("character_id", data.character_id);
    const sessIds = ((parts as any[]) ?? []).map((p) => p.session_id);
    let activeSessionId: string | null = null;
    if (sessIds.length) {
      const { data: act } = await supabase.from("combat_sessions").select("id").in("id", sessIds).eq("status", "active").limit(1).maybeSingle();
      activeSessionId = (act as any)?.id ?? null;
    }
    return {
      state: (char as any).tutorial_state ?? {},
      completed: !!(char as any).tutorial_completed,
      has_vest_equipped: !!(inv as any)?.vest_id,
      ration_item_id: rationId,
      has_ration: hasRation,
      current_location_id: (char as any).current_location_id ?? null,
      active_combat_id: activeSessionId,
    };
  });

/** Marca uma chave arbitrária no tutorial_state (append merge). */
export const setTutorialFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    character_id: z.string().uuid(),
    flag: z.string().min(1).max(64),
    value: z.any().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,user_id,tutorial_state").eq("id", data.character_id).maybeSingle();
    if (!char || (char as any).user_id !== context.userId) throw new Error("Personagem inválido.");
    const state = { ...((char as any).tutorial_state ?? {}), [data.flag]: data.value ?? true };
    await context.supabase.from("characters").update({ tutorial_state: state }).eq("id", data.character_id);
    return { ok: true, state };
  });

/** Marca o tutorial como concluído. */
export const completeTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("tutorial_state").eq("id", data.character_id).eq("user_id", context.userId).maybeSingle();
    const state = { ...((char as any)?.tutorial_state ?? {}), completed: true, completed_at: new Date().toISOString() };
    const { error } = await context.supabase
      .from("characters")
      .update({ tutorial_completed: true, tutorial_state: state })
      .eq("id", data.character_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });