import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertBlacksmithOrAdmin(context: { supabase: any; userId: string }) {
  const [b, a] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "blacksmith" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
  ]);
  if (b.error) throw new Error(b.error.message);
  if (a.error) throw new Error(a.error.message);
  if (!b.data && !a.data) throw new Error("Forbidden: apenas ferreiros ou admins podem enviar itens.");
  return { isAdmin: !!a.data };
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const skillRank = z.enum(["E","D","C","B","A","S"]);
const ninjaRank = z.enum(["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"]);
const itemType = z.enum(["consumable","tool","material","armor_helmet","armor_vest","armor_pants","armor_boots","weapon","weapon_primary","weapon_secondary"]);

const submissionPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  type: itemType,
  rank: skillRank,
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  durability: z.number().int().min(0).nullable().optional(),
  slot_size: z.number().int().min(1).max(20).default(1),
  stackable: z.boolean().optional(),
  stack_limit: z.number().int().min(1).nullable().optional(),
  req_rank: ninjaRank.nullable().optional(),
  req_class: z.string().max(60).nullable().optional(),
  req_nivel: skillRank.nullable().optional(),
  req_maestria: skillRank.nullable().optional(),
  req_mission_id: z.string().uuid().nullable().optional(),
  req_skill_id: z.string().uuid().nullable().optional(),
  meta: z.object({
    recipe: z.array(z.object({
      item_id: z.string().uuid(),
      qty: z.number().int().min(1).max(999),
    })).nullable().optional(),
  }).partial().passthrough().nullable().optional(),
});

/** Ferreiro (ou admin) envia uma submissão de item. */
export const submitItemSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => submissionPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertBlacksmithOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = {
      ...data,
      submitted_by: context.userId,
      status: "pending",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      approved_item_id: null,
    };
    if (data.id) {
      // Owner só pode editar enquanto pending
      const { data: existing } = await supabaseAdmin.from("item_submissions").select("submitted_by,status").eq("id", data.id).maybeSingle();
      if (!existing) throw new Error("Submissão não encontrada.");
      if (existing.submitted_by !== context.userId) throw new Error("Você não é o dono desta submissão.");
      if (existing.status !== "pending") throw new Error("Submissão já revisada — não pode ser editada.");
      const { error } = await supabaseAdmin.from("item_submissions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    delete payload.id;
    const { data: inserted, error } = await supabaseAdmin.from("item_submissions").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

/** Lista submissões do próprio usuário. */
export const listMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("item_submissions")
      .select("*")
      .eq("submitted_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin: lista todas as submissões (opcional filtro por status). */
export const listAllSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ status: z.enum(["pending","approved","rejected","all"]).default("pending") }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("item_submissions").select("*").order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // enriquece com email do autor
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.submitted_by)));
    let emailsById: Record<string, string> = {};
    if (ids.length) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      emailsById = Object.fromEntries((users?.users ?? []).map((u: any) => [u.id, u.email ?? ""]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, submitter_email: emailsById[r.submitted_by] ?? null }));
  });

/** Admin: aprova a submissão e cria o item no catálogo. */
export const approveSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), notes: z.string().max(2000).nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error: e1 } = await supabaseAdmin.from("item_submissions").select("*").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!sub) throw new Error("Submissão não encontrada.");
    if (sub.status !== "pending") throw new Error("Submissão já foi revisada.");
    const itemPayload: any = {
      name: sub.name,
      type: sub.type,
      rank: sub.rank,
      description: sub.description,
      image_url: sub.image_url,
      durability: sub.durability,
      slot_size: sub.slot_size ?? 1,
      stackable: sub.stackable ?? false,
      stack_limit: sub.stack_limit,
      req_rank: sub.req_rank,
      req_class: sub.req_class,
      req_nivel: sub.req_nivel,
      req_maestria: sub.req_maestria,
      req_mission_id: sub.req_mission_id,
      req_skill_id: sub.req_skill_id,
      meta: sub.meta ?? {},
    };
    const { data: created, error: e2 } = await supabaseAdmin.from("items").insert(itemPayload).select("id").single();
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin.from("item_submissions").update({
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: data.notes ?? null,
      approved_item_id: created.id,
    }).eq("id", data.id);
    if (e3) throw new Error(e3.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "approve_item_submission", target: data.id, meta: { item_id: created.id } });
    return { ok: true, item_id: created.id };
  });

/** Admin: rejeita a submissão. */
export const rejectSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), notes: z.string().max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error: e1 } = await supabaseAdmin.from("item_submissions").select("status").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!sub) throw new Error("Submissão não encontrada.");
    if (sub.status !== "pending") throw new Error("Submissão já foi revisada.");
    const { error } = await supabaseAdmin.from("item_submissions").update({
      status: "rejected",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: data.notes,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "reject_item_submission", target: data.id, meta: { notes: data.notes } });
    return { ok: true };
  });

/** Owner (pendente) ou admin: remove a submissão. */
export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin.from("item_submissions").select("submitted_by,status").eq("id", data.id).maybeSingle();
    if (!sub) throw new Error("Submissão não encontrada.");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const isOwnerPending = sub.submitted_by === context.userId && sub.status === "pending";
    if (!isAdmin && !isOwnerPending) throw new Error("Sem permissão.");
    const { error } = await supabaseAdmin.from("item_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });