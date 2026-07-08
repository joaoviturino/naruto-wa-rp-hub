import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const villageEnum = z.enum([
  "konoha","suna","kiri","kumo","iwa","ame","kusa","taki","oto","yuki","hoshi","nomad",
]);
const elementEnum = z.enum(["katon","suiton","fuuton","doton","raiton"]);

// Weighted random from clans of a village.
function pickWeighted<T extends { weight: number }>(rows: T[], rng = Math.random): T {
  const total = rows.reduce((s, r) => s + Math.max(1, r.weight), 0);
  let r = rng() * total;
  for (const row of rows) {
    r -= Math.max(1, row.weight);
    if (r <= 0) return row;
  }
  return rows[rows.length - 1];
}

/** Sortear um clã aleatório da vila (respeitando pesos). Consome 1 reroll se já houver personagem. */
export const rollClan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ village: villageEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: clans, error } = await context.supabase
      .from("clans")
      .select("id,name,village,rarity,element_bonus,description,weight")
      .eq("village", data.village);
    if (error) throw new Error(error.message);
    if (!clans || clans.length === 0) throw new Error("Nenhum clã disponível para esta vila.");
    const picked = pickWeighted(clans);
    return picked;
  });

/** Cria o personagem do jogador e enfileira mensagem de boas-vindas no WhatsApp. */
export const createCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nickname: z.string().trim().min(2).max(40),
        phone_e164: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Telefone inválido"),
        village: villageEnum,
        clan_id: z.string().uuid(),
        element_primary: elementEnum,
        age: z.number().int().min(8).max(120).optional(),
        appearance: z.string().max(2000).optional(),
        personality: z.string().max(2000).optional(),
        history: z.string().max(4000).optional(),
        bio: z.string().max(500).optional(),
        clan_rerolls_used: z.number().int().min(0).max(3).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const phone = data.phone_e164.startsWith("+") ? data.phone_e164 : `+${data.phone_e164}`;

    const { data: existing } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (existing) throw new Error("Você já criou um personagem.");

    const { data: char, error } = await context.supabase
      .from("characters")
      .insert({
        user_id: context.userId,
        nickname: data.nickname,
        phone_e164: phone,
        village: data.village,
        clan_id: data.clan_id,
        element_primary: data.element_primary,
        age: data.age,
        appearance: data.appearance,
        personality: data.personality,
        history: data.history,
        bio: data.bio,
        clan_rerolls_used: data.clan_rerolls_used,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("inventory").insert({ character_id: char.id });

    // Enqueue welcome — admin/service reads this queue via the bot.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("outbound_messages").insert({
      to_phone: phone,
      body: `🍥 *New Era Shinobi — Revolution*\n\nBem-vindo, ${data.nickname}! Sua ficha foi selada. A partir de agora, sua jornada como shinobi de ${data.village.toUpperCase()} acontece aqui neste chat.\n\nEnvie *!ajuda* para começar.`,
    });

    return { id: char.id };
  });

/** Atualiza campos livres da ficha (bio/aparência/personalidade/história/imagens). */
export const updateCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      appearance: z.string().max(2000).optional(),
      personality: z.string().max(2000).optional(),
      history: z.string().max(4000).optional(),
      bio: z.string().max(500).optional(),
      avatar_url: z.string().url().optional(),
      banner_url: z.string().url().optional(),
      inventory_bg_url: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters").update(data).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });