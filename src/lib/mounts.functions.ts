import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Somente admins.");
}

const MountInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  image_url: z.string().url().nullish(),
  travel_gif_url: z.string().url().nullish(),
  description: z.string().max(2000).nullish(),
  rank: z.string().max(40).nullish(),
  speed_multiplier: z.number().min(0.05).max(1),
});

export const listMounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("mounts").select("*").order("name");
    return { mounts: (data as any[]) ?? [] };
  });

export const upsertMount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MountInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context.supabase, context.userId);
    const payload = {
      name: data.name,
      image_url: data.image_url ?? null,
      travel_gif_url: data.travel_gif_url ?? null,
      description: data.description ?? null,
      rank: data.rank ?? null,
      speed_multiplier: data.speed_multiplier,
    };
    if (data.id) {
      const { error } = await context.supabase.from("mounts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("mounts").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteMount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("mounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantMountToCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    characterId: z.string().uuid(),
    mountId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("character_mounts")
      .insert({ character_id: data.characterId, mount_id: data.mountId });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const revokeMountFromCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    characterId: z.string().uuid(),
    mountId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("character_mounts")
      .delete().eq("character_id", data.characterId).eq("mount_id", data.mountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lista as montarias do jogador logado com a config de pose atual (pose_id, offset, escala)
 * e todos os dados da montaria (incluindo travel_gif_url).
 */
export const listMyOwnedMounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return { mounts: [] };
    const { data } = await context.supabase
      .from("character_mounts")
      .select("id,mount_id,pose_id,pose_offset_x,pose_offset_y,pose_scale,mount:mounts(id,name,image_url,travel_gif_url,description,rank,speed_multiplier)")
      .eq("character_id", (char as any).id);
    return { mounts: (data as any[]) ?? [] };
  });

/** Salva a pose escolhida e o ajuste de posição/escala para uma montaria do jogador. */
export const configureMountPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    mountId: z.string().uuid(),
    poseId: z.string().uuid().nullable(),
    offsetX: z.number().min(-100).max(100).default(0),
    offsetY: z.number().min(-100).max(100).default(0),
    scale: z.number().min(0.2).max(3).default(1),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    // valida que a pose pertence ao personagem, se informada
    if (data.poseId) {
      const { data: p } = await context.supabase
        .from("character_poses").select("id").eq("id", data.poseId).eq("character_id", (char as any).id).maybeSingle();
      if (!p) throw new Error("Pose inválida.");
    }
    const { error } = await context.supabase.from("character_mounts").update({
      pose_id: data.poseId,
      pose_offset_x: data.offsetX,
      pose_offset_y: data.offsetY,
      pose_scale: data.scale,
    }).eq("character_id", (char as any).id).eq("mount_id", data.mountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });