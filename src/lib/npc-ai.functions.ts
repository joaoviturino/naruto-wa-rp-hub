import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const STYLE_GUIDE = `FORMATO DE ROLEPLAY OBRIGATÓRIO (siga rigorosamente):
- Ações e narração começam com "❕️ " (emoji seguido de espaço). Ex: ❕️ Cruzo os braços e observo em silêncio.
- Falas começam com "- " (traço e espaço). Ex: - Você chegou tarde.
- Nunca use aspas para diálogo. Nunca use asteriscos para ação.
- Uma resposta curta e viva (1 a 4 linhas). Sem quebrar personagem, sem meta-comentários, sem citar que é IA.
- Escreva em português do Brasil.`;

function buildSystemPrompt(npc: any): string {
  const bits: string[] = [];
  bits.push(`Você interpreta o personagem "${npc.name}" em um RPG de Naruto ambientado em vilas ninja. Fique 100% no personagem.`);
  if (npc.ai_personality) bits.push(`Personalidade: ${npc.ai_personality}`);
  if (npc.ai_background) bits.push(`História / Background: ${npc.ai_background}`);
  if (npc.ai_goals) bits.push(`Objetivos e motivações: ${npc.ai_goals}`);
  if (npc.ai_tone) bits.push(`Tom de fala: ${npc.ai_tone}`);
  if (npc.ai_knowledge) bits.push(`O que sabe / não sabe: ${npc.ai_knowledge}`);
  if (npc.ai_extra) bits.push(`Instruções extras: ${npc.ai_extra}`);
  if (npc.description) bits.push(`Descrição pública: ${npc.description}`);
  bits.push(STYLE_GUIDE);
  return bits.join("\n\n");
}

async function callGroq(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      max_tokens: 300,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Groq ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const out: string = j?.choices?.[0]?.message?.content ?? "";
  return out.trim();
}

/** Dispara respostas dos NPCs de IA presentes no local que estão em modo público/both. */
export const respondNpcsInLocation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    locationId: z.string().uuid(),
    triggerMessageId: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // NPCs de IA vinculados ao local
    const { data: links } = await supabaseAdmin
      .from("location_npcs").select("npc_id").eq("location_id", data.locationId);
    const npcIds = (links ?? []).map((r: any) => r.npc_id);
    if (npcIds.length === 0) return { replied: 0 };
    const { data: npcs } = await supabaseAdmin
      .from("npcs")
      .select("*")
      .in("id", npcIds)
      .eq("ai_enabled", true)
      .in("ai_mode", ["public", "both"]);
    if (!npcs || npcs.length === 0) return { replied: 0 };

    // Última mensagem (gatilho) + histórico curto do local
    const { data: trigger } = await supabaseAdmin
      .from("location_messages").select("id,content,character_id,npc_id").eq("id", data.triggerMessageId).maybeSingle();
    if (!trigger || (trigger as any).npc_id) return { replied: 0 }; // ignora eco de NPC

    const { data: history } = await supabaseAdmin
      .from("location_messages")
      .select("id,content,character_id,npc_id,created_at,characters(nickname)")
      .eq("location_id", data.locationId)
      .order("created_at", { ascending: false })
      .limit(12);
    const historyAsc = ((history as any[]) ?? []).slice().reverse();

    let replied = 0;
    for (const npc of npcs as any[]) {
      // trava para evitar dupla resposta
      const { error: lockErr } = await supabaseAdmin
        .from("npc_ai_response_locks")
        .insert({ npc_id: npc.id, trigger_message_id: data.triggerMessageId });
      if (lockErr) continue;

      const msgs = historyAsc.map((m: any) => {
        if (m.npc_id === npc.id) return { role: "assistant" as const, content: m.content };
        const who = m.npc_id ? "[Outro NPC]" : (m.characters?.nickname ?? "Jogador");
        return { role: "user" as const, content: `${who}: ${m.content}` };
      });
      try {
        const reply = await callGroq(buildSystemPrompt(npc), msgs);
        if (reply) {
          await supabaseAdmin.from("location_messages").insert({
            location_id: data.locationId,
            npc_id: npc.id,
            character_id: null,
            content: reply,
          });
          replied++;
        }
      } catch (e) {
        console.error("[npc-ai]", npc.name, e);
      }
    }
    return { replied };
  });

/** Popup 1-a-1: envia msg do jogador, gera resposta do NPC, persiste os dois. */
export const sendNpcPrivateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    npcId: z.string().uuid(),
    content: z.string().trim().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,nickname").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: npc } = await supabaseAdmin.from("npcs").select("*").eq("id", data.npcId).maybeSingle();
    if (!npc) throw new Error("NPC não encontrado.");
    if (!(npc as any).ai_enabled) throw new Error("Este NPC não fala.");
    if ((npc as any).ai_mode === "public") throw new Error("Este NPC só conversa no chat público.");

    // grava input do jogador
    const { data: userMsg, error: uErr } = await context.supabase
      .from("npc_private_messages")
      .insert({ npc_id: data.npcId, character_id: (char as any).id, role: "user", content: data.content })
      .select("id,role,content,created_at").single();
    if (uErr) throw new Error(uErr.message);

    // histórico
    const { data: hist } = await supabaseAdmin
      .from("npc_private_messages")
      .select("role,content")
      .eq("npc_id", data.npcId).eq("character_id", (char as any).id)
      .order("created_at", { ascending: false }).limit(24);
    const msgs = ((hist as any[]) ?? []).slice().reverse().map((m: any) => ({
      role: m.role as "user" | "assistant", content: m.content,
    }));

    const reply = await callGroq(buildSystemPrompt(npc), msgs);
    const { data: aiMsg, error: aErr } = await supabaseAdmin
      .from("npc_private_messages")
      .insert({ npc_id: data.npcId, character_id: (char as any).id, role: "assistant", content: reply })
      .select("id,role,content,created_at").single();
    if (aErr) throw new Error(aErr.message);

    return { user: userMsg, assistant: aiMsg };
  });

export const listNpcPrivateHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npcId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return [];
    const { data } = await context.supabase
      .from("npc_private_messages")
      .select("id,role,content,created_at")
      .eq("npc_id", data.npcId).eq("character_id", (char as any).id)
      .order("created_at", { ascending: true }).limit(200);
    return data ?? [];
  });

export const clearNpcPrivateHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npcId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return { ok: true };
    await context.supabase.from("npc_private_messages")
      .delete().eq("npc_id", data.npcId).eq("character_id", (char as any).id);
    return { ok: true };
  });