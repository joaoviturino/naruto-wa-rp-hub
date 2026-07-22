import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function myCharacterId(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Personagem não encontrado.");
  return data.id as string;
}

/** Admin: lista poses de um personagem específico. */
export const adminListPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("character_poses").select("*")
      .eq("character_id", data.character_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Admin: cria ou atualiza uma pose. */
export const adminUpsertPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    character_id: z.string().uuid(),
    name: z.string().trim().min(1).max(60),
    image_url: z.string().url(),
    sort_order: z.number().int().min(0).max(999).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      character_id: data.character_id,
      name: data.name,
      image_url: data.image_url,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("character_poses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("character_poses").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Admin: remove pose. */
export const adminDeletePose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("character_poses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Player: lista suas poses (somente leitura). */
export const listMyPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const charId = await myCharacterId(context);
    const { data, error } = await context.supabase
      .from("character_poses").select("*").eq("character_id", charId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Player: lista mapeamentos pose ↔ habilidade. */
export const listMySkillPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const charId = await myCharacterId(context);
    const { data, error } = await context.supabase
      .from("character_skill_poses").select("skill_id,pose_id")
      .eq("character_id", charId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Player: define (ou limpa) qual pose usa em uma habilidade. */
export const setSkillPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    skill_id: z.string().uuid(),
    pose_id: z.string().uuid().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const charId = await myCharacterId(context);
    if (data.pose_id === null) {
      const { error } = await context.supabase
        .from("character_skill_poses").delete()
        .eq("character_id", charId).eq("skill_id", data.skill_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    // Valida que a pose pertence ao personagem
    const { data: pose, error: pErr } = await context.supabase
      .from("character_poses").select("id").eq("id", data.pose_id).eq("character_id", charId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pose) throw new Error("Pose inválida.");
    const { error } = await context.supabase
      .from("character_skill_poses")
      .upsert({ character_id: charId, skill_id: data.skill_id, pose_id: data.pose_id },
        { onConflict: "character_id,skill_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
