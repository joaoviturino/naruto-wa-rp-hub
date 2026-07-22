import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMyChar(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("characters").select("id,ryo,nickname").eq("user_id", context.userId).maybeSingle();
  if (!data) throw new Error("Sem personagem.");
  return data as { id: string; ryo: number; nickname: string };
}

async function assertOwnerOrAdmin(context: { supabase: any; userId: string }, locationId: string) {
  const { data: loc } = await context.supabase
    .from("locations").select("id,owner_character_id").eq("id", locationId).maybeSingle();
  if (!loc) throw new Error("Local não encontrado.");
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (isAdmin) return { loc, isAdmin: true as const };
  const me = await getMyChar(context);
  if ((loc as any).owner_character_id !== me.id) throw new Error("Apenas o dono pode gerenciar este local.");
  return { loc, isAdmin: false as const, me };
}

/** Locais à venda visíveis a qualquer autenticado. */
export const listLocationsForSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("locations")
      .select("id,name,image_url,description,sale_price,owner_character_id,is_private,is_for_sale")
      .eq("is_for_sale", true)
      .order("sale_price");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Locais que pertencem ao personagem atual. */
export const listMyLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMyChar(context);
    const { data, error } = await context.supabase
      .from("locations")
      .select("id,name,image_url,is_private,is_for_sale,sale_price")
      .eq("owner_character_id", me.id)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Lista as permissões concedidas em um local (com nick do personagem). */
export const listLocationPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ location_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context, data.location_id);
    const { data: rows, error } = await context.supabase
      .from("location_permissions")
      .select("id,character_id,created_at,character:characters(nickname)")
      .eq("location_id", data.location_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, character_id: r.character_id, created_at: r.created_at,
      nickname: r.character?.nickname ?? "?",
    }));
  });

/** Concede acesso pelo nickname do personagem. */
export const grantLocationAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    nickname: z.string().trim().min(1).max(64),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { me } = await assertOwnerOrAdmin(context, data.location_id) as any;
    const { data: target } = await context.supabase
      .from("characters").select("id,nickname").ilike("nickname", data.nickname).limit(1).maybeSingle();
    if (!target) throw new Error("Personagem não encontrado.");
    if (me && target.id === me.id) throw new Error("Você já é o dono.");
    const { error } = await context.supabase
      .from("location_permissions")
      .upsert({ location_id: data.location_id, character_id: target.id, granted_by: me?.id ?? null }, { onConflict: "location_id,character_id" });
    if (error) throw new Error(error.message);
    return { ok: true, character: target };
  });

/** Revoga o acesso de um personagem. */
export const revokeLocationAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    character_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context, data.location_id);
    const { error } = await context.supabase
      .from("location_permissions").delete()
      .eq("location_id", data.location_id).eq("character_id", data.character_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Alterna público/privado e configura venda. */
export const setLocationOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    is_private: z.boolean().optional(),
    is_for_sale: z.boolean().optional(),
    sale_price: z.number().int().min(0).max(100_000_000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context, data.location_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (typeof data.is_private === "boolean") patch.is_private = data.is_private;
    if (typeof data.is_for_sale === "boolean") patch.is_for_sale = data.is_for_sale;
    if (typeof data.sale_price === "number") patch.sale_price = data.sale_price;
    // Locais à venda passam a ser privados por natureza para o comprador.
    if (data.is_for_sale === true) patch.is_private = true;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("locations").update(patch as any).eq("id", data.location_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Compra um local à venda. Debita ryō, transfere posse, marca privado, tira do mercado. */
export const buyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ location_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loc } = await supabaseAdmin
      .from("locations").select("id,name,is_for_sale,sale_price,owner_character_id")
      .eq("id", data.location_id).maybeSingle();
    if (!loc) throw new Error("Local não encontrado.");
    if (!(loc as any).is_for_sale) throw new Error("Este local não está à venda.");
    if ((loc as any).owner_character_id === me.id) throw new Error("Você já é o dono.");
    const price = Number((loc as any).sale_price) || 0;
    if ((me.ryo ?? 0) < price) throw new Error(`Ryō insuficiente. Preço: ${price}.`);
    // Debita e transfere em duas etapas (idempotente do lado do jogador via UI).
    const { error: e1 } = await supabaseAdmin.from("characters")
      .update({ ryo: (me.ryo ?? 0) - price }).eq("id", me.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin.from("locations").update({
      owner_character_id: me.id,
      is_for_sale: false,
      is_private: true,
      sale_price: 0,
    }).eq("id", data.location_id);
    if (e2) {
      // rollback do ryō
      await supabaseAdmin.from("characters").update({ ryo: me.ryo ?? 0 }).eq("id", me.id);
      throw new Error(e2.message);
    }
    // Limpa permissões antigas do dono anterior para o novo dono começar limpo.
    await supabaseAdmin.from("location_permissions").delete().eq("location_id", data.location_id);
    return { ok: true, name: (loc as any).name, price };
  });

/** Retorna se o personagem atual pode entrar no local (owner, permitido ou público). */
export const canIAccessLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ location_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("can_access_location", {
      _user_id: context.userId, _location_id: data.location_id,
    });
    if (error) throw new Error(error.message);
    return { allowed: !!ok };
  });