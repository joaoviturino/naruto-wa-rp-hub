import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_LEVEL_CONFIG, type LevelConfig } from "@/lib/level";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getLevelConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LevelConfig> => {
    const { data, error } = await context.supabase
      .from("level_config")
      .select("base_xp,growth_factor,max_level")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_LEVEL_CONFIG;
    return {
      base_xp: Number(data.base_xp),
      growth_factor: Number(data.growth_factor),
      max_level: Number(data.max_level),
    };
  });

export const updateLevelConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      base_xp: z.number().int().min(1).max(1_000_000),
      growth_factor: z.number().min(1).max(5),
      max_level: z.number().int().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("level_config")
      .upsert({ id: true, ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });