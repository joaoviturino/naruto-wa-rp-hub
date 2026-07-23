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

async function loadMyChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,xp,ryo,current_location_id").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

const jobPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(2000).nullish(),
  image_url: z.string().nullish(),
  salary_ryo: z.number().int().min(0).max(10_000_000).default(0),
  salary_xp: z.number().int().min(0).max(1_000_000).default(0),
  salary_interval_hours: z.number().int().min(1).max(720).default(24),
  fire_after_days: z.number().int().min(1).max(365).default(7),
  active: z.boolean().default(true),
  permissions: z.record(z.string(), z.boolean()).default({}),
});

export const listJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("jobs").select("*").order("name");
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });

export const upsertJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => jobPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("jobs").upsert(data as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Contrata o personagem no emprego oferecido pelo NPC. */
export const hireFromNpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npc_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirma que o NPC está no mesmo local
    const { data: ln } = await supabaseAdmin.from("location_npcs")
      .select("npc_id").eq("location_id", me.current_location_id).eq("npc_id", data.npc_id).maybeSingle();
    if (!ln) throw new Error("Este NPC não está aqui.");
    const { data: npc } = await supabaseAdmin.from("npcs")
      .select("kind,offered_job_id").eq("id", data.npc_id).maybeSingle();
    if (!npc || (npc as any).kind !== "employer" || !(npc as any).offered_job_id) throw new Error("NPC não contrata para nenhum emprego.");
    const jobId = (npc as any).offered_job_id;
    const { data: job } = await supabaseAdmin.from("jobs").select("active").eq("id", jobId).maybeSingle();
    if (!job || !(job as any).active) throw new Error("Emprego indisponível.");
    const { data: existing } = await supabaseAdmin.from("character_jobs")
      .select("id,status").eq("character_id", me.id).eq("job_id", jobId).maybeSingle();
    if (existing && (existing as any).status === "active") throw new Error("Você já está contratado neste emprego.");
    if (existing) {
      await supabaseAdmin.from("character_jobs").update({
        status: "active", hired_at: new Date().toISOString(), last_paid_at: null, last_activity_at: new Date().toISOString(),
      }).eq("id", (existing as any).id);
    } else {
      const { error } = await supabaseAdmin.from("character_jobs").insert({
        character_id: me.id, job_id: jobId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Player pede demissão de um emprego. */
export const quitJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("character_jobs")
      .update({ status: "quit" }).eq("character_id", me.id).eq("job_id", data.job_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Calcula parcelas pendentes e paga salários acumulados desde last_paid_at. */
export const collectSalary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npc_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ln } = await supabaseAdmin.from("location_npcs")
      .select("npc_id").eq("location_id", me.current_location_id).eq("npc_id", data.npc_id).maybeSingle();
    if (!ln) throw new Error("NPC não está aqui.");
    const { data: npc } = await supabaseAdmin.from("npcs").select("offered_job_id,kind").eq("id", data.npc_id).maybeSingle();
    if (!npc || (npc as any).kind !== "employer") throw new Error("Este NPC não paga salário.");
    const jobId = (npc as any).offered_job_id;
    if (!jobId) throw new Error("NPC sem emprego vinculado.");
    const { data: job } = await supabaseAdmin.from("jobs").select("*").eq("id", jobId).maybeSingle();
    if (!job) throw new Error("Emprego não encontrado.");
    const { data: cj } = await supabaseAdmin.from("character_jobs")
      .select("*").eq("character_id", me.id).eq("job_id", jobId).maybeSingle();
    if (!cj || (cj as any).status !== "active") throw new Error("Você não trabalha aqui.");
    const j = job as any;
    const c = cj as any;
    // Verifica inatividade para demissão automática
    const inactiveMs = Date.now() - new Date(c.last_activity_at ?? c.hired_at).getTime();
    if (inactiveMs > j.fire_after_days * 86400_000) {
      await supabaseAdmin.from("character_jobs").update({ status: "fired" }).eq("id", c.id);
      throw new Error(`Você foi demitido por inatividade (mais de ${j.fire_after_days} dias sem trabalhar).`);
    }
    const intervalMs = j.salary_interval_hours * 3600_000;
    const anchor = new Date(c.last_paid_at ?? c.hired_at).getTime();
    const elapsed = Date.now() - anchor;
    const cycles = Math.floor(elapsed / intervalMs);
    if (cycles <= 0) {
      const nextIn = intervalMs - elapsed;
      const h = Math.ceil(nextIn / 3600_000);
      throw new Error(`Próximo pagamento em ~${h}h.`);
    }
    const capped = Math.min(cycles, 30);
    const payRyo = j.salary_ryo * capped;
    const payXp = j.salary_xp * capped;
    const newAnchor = new Date(anchor + capped * intervalMs).toISOString();
    await supabaseAdmin.from("characters").update({
      ryo: Number(me.ryo ?? 0) + payRyo,
      xp: Number(me.xp ?? 0) + payXp,
    }).eq("id", me.id);
    await supabaseAdmin.from("character_jobs").update({ last_paid_at: newAnchor }).eq("id", c.id);
    return { ok: true, ryo: payRyo, xp: payXp, cycles: capped };
  });

/** Lista os empregos ativos do personagem logado. */
export const listMyJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyChar(context);
    const { data } = await context.supabase
      .from("character_jobs")
      .select("id,status,hired_at,last_paid_at,last_activity_at,job:jobs(id,name,description,image_url,salary_ryo,salary_xp,salary_interval_hours,fire_after_days)")
      .eq("character_id", me.id).eq("status", "active");
    return { jobs: data ?? [] };
  });

/** Retorna info do vínculo player↔emprego oferecido pelo NPC. */
export const getNpcJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npc_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { data: npc } = await context.supabase.from("npcs").select("offered_job_id,kind").eq("id", data.npc_id).maybeSingle();
    if (!npc || (npc as any).kind !== "employer" || !(npc as any).offered_job_id) return { job: null, employment: null, next_pay_ms: null };
    const jobId = (npc as any).offered_job_id;
    const { data: job } = await context.supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
    const { data: cj } = await context.supabase.from("character_jobs")
      .select("*").eq("character_id", me.id).eq("job_id", jobId).maybeSingle();
    let next_pay_ms: number | null = null;
    if (cj && (cj as any).status === "active" && job) {
      const anchor = new Date((cj as any).last_paid_at ?? (cj as any).hired_at).getTime();
      next_pay_ms = Math.max(0, anchor + (job as any).salary_interval_hours * 3600_000 - Date.now());
    }
    return { job, employment: cj ?? null, next_pay_ms };
  });

/** Admin dispensa/atribui manualmente um emprego a um player. */
export const adminSetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    character_id: z.string().uuid(),
    job_id: z.string().uuid(),
    action: z.enum(["hire","fire"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "fire") {
      await supabaseAdmin.from("character_jobs").update({ status: "fired" })
        .eq("character_id", data.character_id).eq("job_id", data.job_id);
    } else {
      const { data: ex } = await supabaseAdmin.from("character_jobs")
        .select("id").eq("character_id", data.character_id).eq("job_id", data.job_id).maybeSingle();
      if (ex) {
        await supabaseAdmin.from("character_jobs").update({
          status: "active", hired_at: new Date().toISOString(), last_activity_at: new Date().toISOString(), last_paid_at: null,
        }).eq("id", (ex as any).id);
      } else {
        await supabaseAdmin.from("character_jobs").insert({ character_id: data.character_id, job_id: data.job_id });
      }
    }
    return { ok: true };
  });
