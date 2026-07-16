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
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      name: data.name,
      image_url: data.image_url ?? null,
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