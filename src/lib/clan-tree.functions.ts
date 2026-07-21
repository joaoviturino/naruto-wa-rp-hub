import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getClanTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: nodes }, { data: edges }] = await Promise.all([
      context.supabase.from("clan_tree_nodes")
        .select("id,clan_id,kind,skill_id,buff_type,buff_value,buff_label,buff_icon_url,x,y,rank_required,min_prereqs,xp_required, skill:skills(id,name,rank,image_url,description)")
        .eq("clan_id", data.clan_id),
      context.supabase.from("clan_tree_edges").select("id,from_node_id,to_node_id").eq("clan_id", data.clan_id),
    ]);
    // Progresso do caller (se tiver personagem)
    const { data: me } = await context.supabase.from("characters").select("id,clan_id").eq("user_id", context.userId).maybeSingle();
    let progress: string[] = [];
    if (me?.id) {
      const { data: pr } = await context.supabase.from("character_clan_progress")
        .select("node_id").eq("character_id", me.id);
      progress = (pr ?? []).map((r: any) => r.node_id);
    }
    return { nodes: nodes ?? [], edges: edges ?? [], progress, my_character_id: me?.id ?? null, my_clan_id: me?.clan_id ?? null };
  });

const nodeInput = z.object({
  id: z.string().optional(),
  kind: z.enum(["skill","buff"]),
  skill_id: z.string().uuid().nullish(),
  buff_type: z.enum(["hp_bonus","energy_bonus","skill_power_bonus","skill_cost_reduction"]).nullish(),
  buff_value: z.number().int().min(-10000).max(10000).nullish(),
  buff_label: z.string().max(120).nullish(),
  buff_icon_url: z.string().nullish(),
  x: z.number().int(),
  y: z.number().int(),
  rank_required: z.string().max(24).nullish(),
  min_prereqs: z.number().int().min(0).max(50).nullish(),
  xp_required: z.number().int().min(0).nullish(),
});
const edgeInput = z.object({ from_node_id: z.string(), to_node_id: z.string() });

export const saveClanTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    clan_id: z.string().uuid(),
    nodes: z.array(nodeInput),
    edges: z.array(edgeInput),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar existentes
    const { data: existing } = await supabaseAdmin.from("clan_tree_nodes").select("id").eq("clan_id", data.clan_id);
    const existingIds = new Set(((existing as any[]) ?? []).map((r) => r.id));
    const keepIds = new Set<string>();

    // Map de temp ids (sem uuid) → uuid gerado
    const idMap = new Map<string, string>();

    // Upsert cada node
    for (const n of data.nodes) {
      const payload: any = {
        clan_id: data.clan_id, kind: n.kind,
        skill_id: n.kind === "skill" ? n.skill_id ?? null : null,
        buff_type: n.kind === "buff" ? n.buff_type ?? null : null,
        buff_value: n.kind === "buff" ? n.buff_value ?? 0 : null,
        buff_label: n.buff_label ?? null,
        buff_icon_url: n.buff_icon_url ?? null,
        x: n.x, y: n.y,
        rank_required: n.rank_required ?? null,
        min_prereqs: n.min_prereqs ?? null,
        xp_required: n.xp_required ?? null,
      };
      if (n.id && existingIds.has(n.id)) {
        const { error } = await supabaseAdmin.from("clan_tree_nodes").update(payload).eq("id", n.id);
        if (error) throw new Error(error.message);
        keepIds.add(n.id);
        if (n.id) idMap.set(n.id, n.id);
      } else {
        const { data: ins, error } = await supabaseAdmin.from("clan_tree_nodes").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        keepIds.add(ins.id);
        if (n.id) idMap.set(n.id, ins.id); else idMap.set(String(payload.x)+"_"+String(payload.y)+"_"+Math.random(), ins.id);
      }
    }
    // Deletar nodes removidos (cascade limpa edges/progress)
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length) await supabaseAdmin.from("clan_tree_nodes").delete().in("id", toDelete);

    // Rewrite edges
    await supabaseAdmin.from("clan_tree_edges").delete().eq("clan_id", data.clan_id);
    if (data.edges.length) {
      const rows = data.edges
        .map((e) => ({
          clan_id: data.clan_id,
          from_node_id: idMap.get(e.from_node_id) ?? e.from_node_id,
          to_node_id: idMap.get(e.to_node_id) ?? e.to_node_id,
        }))
        .filter((e) => keepIds.has(e.from_node_id) && keepIds.has(e.to_node_id));
      if (rows.length) {
        const { error } = await supabaseAdmin.from("clan_tree_edges").insert(rows);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

export const unlockClanNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ node_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("characters")
      .select("id,clan_id,xp,rank").eq("user_id", context.userId).maybeSingle();
    if (!me?.id) throw new Error("Sem personagem.");
    const { data: node } = await context.supabase.from("clan_tree_nodes")
      .select("id,clan_id,kind,buff_type,buff_value,rank_required,min_prereqs,xp_required").eq("id", data.node_id).maybeSingle();
    if (!node) throw new Error("Nó inexistente.");
    if (node.clan_id !== me.clan_id) throw new Error("Este nó não pertence ao seu clã.");

    // XP mínimo
    if (node.xp_required != null && (me.xp ?? 0) < node.xp_required) {
      throw new Error(`XP insuficiente. Requer ${node.xp_required} XP.`);
    }
    // Rank mínimo
    if (node.rank_required) {
      const order = ["estudante","genin","chunin","jonin","anbu","kage"];
      const need = order.indexOf(node.rank_required);
      const have = order.indexOf(me.rank ?? "estudante");
      if (need > -1 && have < need) throw new Error(`Requer patente ${node.rank_required} ou superior.`);
    }

    // Já destravado?
    const { data: has } = await context.supabase.from("character_clan_progress")
      .select("node_id").eq("character_id", me.id).eq("node_id", node.id).maybeSingle();
    if (has) return { ok: true, already: true };

    // Verificar pré-requisitos (nós conectados de entrada)
    const { data: incoming } = await context.supabase.from("clan_tree_edges")
      .select("from_node_id").eq("to_node_id", node.id);
    const reqIds = ((incoming as any[]) ?? []).map((r) => r.from_node_id);
    if (reqIds.length) {
      const { data: unlocked } = await context.supabase.from("character_clan_progress")
        .select("node_id").eq("character_id", me.id).in("node_id", reqIds);
      const unlockedSet = new Set(((unlocked as any[]) ?? []).map((r) => r.node_id));
      const unlockedCount = reqIds.filter((id: string) => unlockedSet.has(id)).length;
      const needed = node.min_prereqs != null ? Math.min(node.min_prereqs, reqIds.length) : reqIds.length;
      if (unlockedCount < needed) {
        throw new Error(`Pré-requisitos: destrave ${needed} nó(s) conectado(s) (${unlockedCount}/${needed}).`);
      }
    }

    const { error } = await context.supabase.from("character_clan_progress")
      .insert({ character_id: me.id, node_id: node.id });
    if (error) throw new Error(error.message);

    // Se for nó de habilidade, concede a skill ao personagem (permite uso em combate).
    if (node.kind === "skill") {
      const { data: full } = await context.supabase.from("clan_tree_nodes")
        .select("skill_id").eq("id", node.id).maybeSingle();
      const skillId = (full as any)?.skill_id;
      if (skillId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: has } = await supabaseAdmin.from("character_skills")
          .select("skill_id").eq("character_id", me.id).eq("skill_id", skillId).maybeSingle();
        if (!has) {
          await supabaseAdmin.from("character_skills")
            .insert({ character_id: me.id, skill_id: skillId });
        }
      }
    }
    return { ok: true, already: false };
  });

/** Retorna buffs agregados do personagem atual. Usado no combate. */
export async function getCharBuffs(supabaseClient: any, characterId: string) {
  const { data } = await supabaseClient.from("character_clan_progress")
    .select("node:clan_tree_nodes(kind,buff_type,buff_value)")
    .eq("character_id", characterId);
  const totals = { hp_bonus: 0, energy_bonus: 0, skill_power_bonus: 0, skill_cost_reduction: 0 };
  for (const r of ((data as any[]) ?? [])) {
    const n = r.node;
    if (!n || n.kind !== "buff" || !n.buff_type) continue;
    totals[n.buff_type as keyof typeof totals] += Number(n.buff_value ?? 0);
  }
  return totals;
}
