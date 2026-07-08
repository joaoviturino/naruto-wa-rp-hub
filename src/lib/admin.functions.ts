import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Auto-promote the first authenticated user to admin (bootstrap). */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um admin. Peça a promoção a um admin existente.");
    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    return { ok: true };
  });

/** Send a test message via the bot queue. */
export const enqueueMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ to_phone: z.string().min(6), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.to_phone.startsWith("+") ? data.to_phone : `+${data.to_phone}`;
    const { error } = await supabaseAdmin.from("outbound_messages").insert({ to_phone: phone, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reset bot session (forces bot to reconnect). */
export const resetBotSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bot_sessions").upsert({ id: "default", status: "disconnected", qr: null, phone: null });
    return { ok: true };
  });

/** Request a fresh QR code from the bot service. */
export const requestBotQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bot_sessions").upsert({
      id: "default",
      status: "disconnected",
      qr: `__REQUEST_QR__:${Date.now()}`,
      phone: null,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Grant / revoke roles, adjust xp. */
export const setUserXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ character_id: z.string().uuid(), xp: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("characters").update({ xp: data.xp }).eq("id", data.character_id);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "set_xp", target: data.character_id, meta: { xp: data.xp } });
    return { ok: true };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin","user"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: data.role });
    return { ok: true };
  });