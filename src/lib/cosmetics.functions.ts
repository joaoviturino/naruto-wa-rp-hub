import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CosmeticSlot = "hair" | "face" | "clothing" | "accessory";

async function assertAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Somente admins.");
}

export const listCosmeticPieces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { includeInactive?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("cosmetic_pieces")
      .select("*")
      .order("slot", { ascending: true })
      .order("sort_order", { ascending: true });
    if (!data.includeInactive) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCosmeticPiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    slot: CosmeticSlot;
    name: string;
    image_url: string;
    z_index?: number;
    sort_order?: number;
    active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = {
      slot: data.slot,
      name: data.name.trim(),
      image_url: data.image_url,
      z_index: data.z_index ?? 0,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("cosmetic_pieces").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("cosmetic_pieces").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCosmeticPiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cosmetic_pieces").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCharacterCosmetics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { characterId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("character_cosmetics")
      .select("slot, piece:cosmetic_pieces(id,name,image_url,z_index,slot)")
      .eq("character_id", data.characterId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const setCharacterCosmetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { characterId: string; slot: CosmeticSlot; pieceId: string | null }) => d)
  .handler(async ({ data, context }) => {
    // RLS garante que o usuário só altere o próprio personagem.
    if (data.pieceId === null) {
      const { error } = await context.supabase
        .from("character_cosmetics")
        .delete()
        .eq("character_id", data.characterId)
        .eq("slot", data.slot);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("character_cosmetics")
      .upsert(
        { character_id: data.characterId, slot: data.slot, piece_id: data.pieceId },
        { onConflict: "character_id,slot" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });