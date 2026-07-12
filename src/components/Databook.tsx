import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProficiencies } from "@/hooks/useProficiencies";

type Skill = { id: string; name: string; rank: string; element: string | null; type: string | null; description: string | null };
type Knowledge = { id: string; name: string; description: string | null };
type Prof = { key: string; label: string; nivel: string | null; maestria: string | null };

const RANKS = ["S", "A", "B", "C", "D", "E"] as const;
const RANK_COLORS: Record<string, string> = {
  S: "text-gold border-gold",
  A: "text-red-400 border-red-500/50",
  B: "text-fuchsia-400 border-fuchsia-500/50",
  C: "text-sky-400 border-sky-500/50",
  D: "text-emerald-400 border-emerald-500/50",
  E: "text-muted-foreground border-border",
};

export function Databook({ characterId }: { characterId: string }) {
  const SKILL_CLASSES = useProficiencies();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ck }, { data: ch }] = await Promise.all([
        supabase.from("character_skills").select("skills(*)").eq("character_id", characterId),
        supabase.from("character_knowledges").select("knowledges(*)").eq("character_id", characterId),
        supabase.from("characters").select("proficiencies").eq("id", characterId).maybeSingle(),
      ]);
      setSkills((cs ?? []).flatMap((r: any) => (r.skills ? [r.skills] : [])));
      setKnowledges((ck ?? []).flatMap((r: any) => (r.knowledges ? [r.knowledges] : [])));
      const raw = (ch?.proficiencies as any) ?? {};
      const list: Prof[] = SKILL_CLASSES
        .map((c) => {
          const e = raw[c.value] ?? {};
          const nivel = e.nivel ?? null;
          const maestria = e.maestria ?? null;
          if (!nivel && !maestria) return null;
          return { key: c.value, label: c.label, nivel, maestria };
        })
        .filter(Boolean) as Prof[];
      setProfs(list);
    })();
  }, [characterId, SKILL_CLASSES]);

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 scroll-panel rounded-lg p-4 sm:p-6">
        <h3 className="font-display text-lg text-gold mb-4">Habilidades aprendidas</h3>
        {skills.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma técnica aprendida ainda. Elas serão liberadas pelo mestre no WhatsApp.</p>}
        <div className="space-y-4">
          {RANKS.map((r) => {
            const list = skills.filter((s) => s.rank === r);
            if (list.length === 0) return null;
            return (
              <div key={r}>
                <div className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${RANK_COLORS[r]}`}>Rank {r}</div>
                <ul className="mt-2 space-y-2">
                  {list.map((s) => (
                    <li key={s.id} className="rounded border border-border p-3">
                      <div className="flex justify-between">
                        <span className="font-semibold">{s.name}</span>
                        {s.element && <span className="text-xs text-gold uppercase">{s.element}</span>}
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="scroll-panel rounded-lg p-4 sm:p-6">
        <h3 className="font-display text-lg text-gold mb-2">Proficiências</h3>
        {profs.length === 0 && <p className="text-sm text-muted-foreground mb-4">Nenhuma proficiência registrada.</p>}
        <ul className="space-y-2 mb-6">
          {profs.map((p) => (
            <li key={p.key} className="rounded border border-border p-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{p.label}</span>
              <span className="flex gap-1 text-[10px]">
                <span className="px-1.5 py-0.5 rounded border border-border">Nv {p.nivel ?? "—"}</span>
                <span className="px-1.5 py-0.5 rounded border border-gold/50 text-gold">M {p.maestria ?? "—"}</span>
              </span>
            </li>
          ))}
        </ul>
        <h3 className="font-display text-lg text-gold mb-2">Conhecimentos</h3>
        {knowledges.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conhecimento registrado.</p>}
        <ul className="space-y-2">
          {knowledges.map((k) => (
            <li key={k.id} className="rounded border border-border p-3">
              <div className="font-semibold">{k.name}</div>
              {k.description && <p className="text-xs text-muted-foreground">{k.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}