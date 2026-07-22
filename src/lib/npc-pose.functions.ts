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

export const adminListNpcPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ npc_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("npc_poses").select("*")
      .eq("npc_id", data.npc_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpsertNpcPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    npc_id: z.string().uuid(),
    name: z.string().trim().min(1).max(60),
    image_url: z.string().url(),
    sort_order: z.number().int().min(0).max(999).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      npc_id: data.npc_id,
      name: data.name,
      image_url: data.image_url,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("npc_poses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("npc_poses").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminDeleteNpcPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("npc_poses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListNpcSkillPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ npc_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("npc_skill_poses").select("skill_id,pose_id")
      .eq("npc_id", data.npc_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSetNpcSkillPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    npc_id: z.string().uuid(),
    skill_id: z.string().uuid(),
    pose_id: z.string().uuid().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.pose_id === null) {
      const { error } = await supabaseAdmin
        .from("npc_skill_poses").delete()
        .eq("npc_id", data.npc_id).eq("skill_id", data.skill_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { data: pose, error: pErr } = await supabaseAdmin
      .from("npc_poses").select("id").eq("id", data.pose_id).eq("npc_id", data.npc_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pose) throw new Error("Pose inválida para este NPC.");
    const { error } = await supabaseAdmin
      .from("npc_skill_poses")
      .upsert({ npc_id: data.npc_id, skill_id: data.skill_id, pose_id: data.pose_id },
        { onConflict: "npc_id,skill_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });