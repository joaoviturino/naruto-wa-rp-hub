import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Move o personagem do usuário atual para um local conectado ao atual (ou qualquer, se ainda não tem local). */
export const moveCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ locationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char, error: cErr } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!char) throw new Error("Você ainda não tem personagem.");

    if (char.current_location_id && char.current_location_id !== data.locationId) {
      // valida que o destino é conectado ao atual
      const a = char.current_location_id < data.locationId ? char.current_location_id : data.locationId;
      const b = char.current_location_id < data.locationId ? data.locationId : char.current_location_id;
      const { data: conn } = await context.supabase
        .from("location_connections").select("id").eq("a_id", a).eq("b_id", b).maybeSingle();
      if (!conn) throw new Error("Este local não é acessível a partir da sua posição atual.");
    }
    const { error } = await context.supabase
      .from("characters").update({ current_location_id: data.locationId }).eq("id", char.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendLocationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    locationId: z.string().uuid(),
    content: z.string().max(2000).default(""),
    imageUrl: z.string().url().nullish(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!data.content.trim() && !data.imageUrl) throw new Error("Escreva algo ou anexe uma imagem.");
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    if (char.current_location_id !== data.locationId) throw new Error("Você não está neste local.");
    const { data: msg, error } = await context.supabase
      .from("location_messages")
      .insert({ location_id: data.locationId, character_id: char.id, content: data.content.trim(), image_url: data.imageUrl ?? null })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: msg.id };
  });