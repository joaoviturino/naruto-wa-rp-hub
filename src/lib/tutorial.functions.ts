import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StarterItem = {
  name: string;
  type: "armor_vest" | "weapon" | "consumable";
  slot_size: number;
  description: string;
  qty: number;
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
  },
];

/** Concede o kit inicial de tutorial ao personagem do jogador (idempotente por nome). */
export const grantStarterKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check
    const { data: char, error: cerr } = await supabase
      .from("characters")
      .select("id,user_id")
      .eq("id", data.character_id)
      .maybeSingle();
    if (cerr) throw new Error(cerr.message);
    if (!char || char.user_id !== userId) throw new Error("Personagem inválido.");

    // Garante linha de inventário
    const { data: inv } = await supabase
      .from("inventory")
      .select("character_id,ninja_bag")
      .eq("character_id", data.character_id)
      .maybeSingle();
    if (!inv) {
      await supabase.from("inventory").insert({ character_id: data.character_id });
    }

    // Upsert dos items pelo nome
    const names = STARTER_ITEMS.map((i) => i.name);
    const { data: existing } = await supabase.from("items").select("id,name").in("name", names);
    const byName = new Map((existing ?? []).map((r: any) => [r.name, r.id as string]));
    const missing = STARTER_ITEMS.filter((i) => !byName.has(i.name)).map((i) => ({
      name: i.name,
      type: i.type,
      slot_size: i.slot_size,
      description: i.description,
    }));
    if (missing.length) {
      const { data: inserted, error: ierr } = await supabase
        .from("items")
        .insert(missing)
        .select("id,name");
      if (ierr) throw new Error(ierr.message);
      for (const row of inserted ?? []) byName.set(row.name, row.id as string);
    }

    // Adiciona na ninja_bag (respeita items já existentes; empilha consumíveis)
    const bagRaw = Array.isArray(inv?.ninja_bag) ? (inv!.ninja_bag as any[]) : [];
    const bag = bagRaw
      .filter((e) => e && e.item_id)
      .map((e) => ({ item_id: e.item_id as string, qty: Math.max(1, Number(e.qty) || 1) }));

    for (const starter of STARTER_ITEMS) {
      const itemId = byName.get(starter.name);
      if (!itemId) continue;
      const idx = bag.findIndex((e) => e.item_id === itemId);
      if (idx >= 0) {
        // não empilha equipamento; apenas garante presença
        if (starter.type === "consumable" || starter.type === "weapon") {
          bag[idx].qty = Math.max(bag[idx].qty, starter.qty);
        }
      } else {
        bag.push({ item_id: itemId, qty: starter.qty });
      }
    }

    const { error: uerr } = await supabase
      .from("inventory")
      .update({ ninja_bag: bag })
      .eq("character_id", data.character_id);
    if (uerr) throw new Error(uerr.message);

    return { granted: true, items: STARTER_ITEMS.map((i) => i.name) };
  });

/** Marca o tutorial como concluído. */
export const completeTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters")
      .update({ tutorial_completed: true })
      .eq("id", data.character_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });