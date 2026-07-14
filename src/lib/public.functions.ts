import { createServerFn } from "@tanstack/react-start";

export type TopPlayer = {
  id: string;
  nickname: string;
  xp: number;
  rank: string | null;
  village: string | null;
  avatar_url: string | null;
  clan_name: string | null;
};

/** Público: top 10 personagens por XP. Só devolve campos seguros. */
export const getTopPlayers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("characters")
    .select("id,nickname,xp,rank,village,avatar_url,clans(name)")
    .order("xp", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({
    id: c.id,
    nickname: c.nickname,
    xp: c.xp ?? 0,
    rank: c.rank ?? null,
    village: c.village ?? null,
    avatar_url: c.avatar_url ?? null,
    clan_name: c.clans?.name ?? null,
  })) as TopPlayer[];
});