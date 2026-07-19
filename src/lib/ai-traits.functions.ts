import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  character_id: z.string().uuid().optional(),
  hint: z.string().max(500).optional(),
});

type Traits = { archetype: string; qualities: string[]; flaws: string[] };

/**
 * Gera Arquétipo, Qualidades e Defeitos usando a Groq API (OpenAI-compatível).
 * Requer o segredo GROQ_API_KEY no servidor.
 */
export const generateTraits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Traits> => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY não configurada.");

    // Busca personagem (do próprio usuário, salvo admin passando character_id)
    let query = context.supabase.from("characters")
      .select("id,user_id,nickname,village,element_primary,appearance,personality,history,bio,clan:clans(name,rarity,element_bonus)");
    if (data.character_id) query = query.eq("id", data.character_id);
    else query = query.eq("user_id", context.userId);
    const { data: char, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!char) throw new Error("Personagem não encontrado.");

    // Se character_id foi passado e não é do próprio usuário, exige admin
    if (data.character_id && (char as any).user_id !== context.userId) {
      const { data: role } = await context.supabase
        .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      if (!role) throw new Error("Sem permissão.");
    }

    const c: any = char;
    const prompt = [
      `Personagem de RPG ninja (Naruto). Gere um Arquétipo, 4 Qualidades e 4 Defeitos coerentes.`,
      `Nome: ${c.nickname}`,
      `Vila: ${c.village}`,
      `Clã: ${c.clan?.name ?? "—"}`,
      `Elemento: ${c.element_primary}`,
      c.bio ? `Bio: ${c.bio}` : "",
      c.appearance ? `Aparência: ${c.appearance}` : "",
      c.personality ? `Personalidade: ${c.personality}` : "",
      c.history ? `História: ${c.history}` : "",
      data.hint ? `Direção do jogador: ${data.hint}` : "",
    ].filter(Boolean).join("\n");

    const system = [
      "Você é um mestre de RPG. Responda APENAS com JSON válido no formato:",
      `{"archetype": string, "qualities": string[4], "flaws": string[4]}`,
      "Arquétipo em 2-4 palavras (ex: 'Protetor Silencioso').",
      "Qualidades e Defeitos em 1-3 palavras cada, em português.",
      "Nada além do JSON. Sem markdown, sem texto extra.",
    ].join(" ");

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Groq falhou (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("IA retornou JSON inválido."); }

    const norm = (arr: any): string[] => Array.isArray(arr)
      ? arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : [];
    const traits: Traits = {
      archetype: String(parsed.archetype ?? "").trim().slice(0, 80) || "Aprendiz",
      qualities: norm(parsed.qualities),
      flaws: norm(parsed.flaws),
    };
    if (traits.qualities.length === 0 || traits.flaws.length === 0) {
      throw new Error("IA não retornou traços suficientes. Tente novamente.");
    }
    return traits;
  });

/** Salva os traços na ficha (do próprio usuário). */
export const saveTraits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    archetype: z.string().max(80).optional(),
    qualities: z.array(z.string().max(60)).max(12).optional(),
    flaws: z.array(z.string().max(60)).max(12).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters").update(data).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });