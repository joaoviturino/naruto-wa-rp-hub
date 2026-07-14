import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { getTopPlayers, type TopPlayer } from "@/lib/public.functions";
import { VILLAGES } from "@/lib/game";

export const Route = createFileRoute("/")({
  loader: async (): Promise<{ top: TopPlayer[] }> => {
    try {
      const top = (await getTopPlayers()) as TopPlayer[];
      return { top };
    } catch {
      return { top: [] as TopPlayer[] };
    }
  },
  component: Index,
});

const RANK_LABEL: Record<string, string> = {
  academy: "Estudante", genin: "Genin", chunin: "Chuunin", jounin: "Jounin",
  anbu: "ANBU", kage: "Kage", sennin: "Sennin", missing: "Missing-nin",
};
function villageName(v: string | null) {
  if (!v) return "Nômade";
  return VILLAGES.find((x) => x.id === v)?.name ?? v;
}

function Index() {
  const { top } = Route.useLoaderData();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-accent blur-3xl" />
      </div>
      <main className="relative mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-24 text-center">
        <p className="text-xs sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.4em] text-gold">新時代 · New Era</p>
        <h1 className="mt-4 sm:mt-6 font-display text-4xl sm:text-7xl font-black text-foreground">
          <span className="text-blood">Shinobi</span>{" "}
          <span className="text-gold">Revolution</span>
        </h1>
        <p className="mt-6 sm:mt-8 mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
          Um RPG shinobi jogado <strong className="text-gold">direto no navegador</strong>.
          Explore o mapa, dispute batalhas turno a turno com sua party, aprenda jutsus com sensei
          NPCs, cumpra missões e forje sua lenda entre as Vilas Ocultas.
        </p>
        <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Iniciar jornada
          </Link>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-md border border-border px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold text-foreground hover:bg-secondary transition"
          >
            O que está rolando
          </a>
        </div>

        <section id="como-funciona" className="mt-16 sm:mt-24 text-left">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-gold text-center">O que está rolando</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            Um mundo vivo, com combate tático, progressão real e sistemas conectados.
          </p>
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: "壱", t: "Criação de shinobi", d: "Sorteie clã, escolha vila, afinidade elemental e monte sua ficha completa." },
              { n: "弐", t: "Chat por localização", d: "Cada local do mapa tem seu próprio chat. Interaja, forme party e viaje pelo mundo." },
              { n: "参", t: "Combate turno a turno", d: "PvE contra NPCs e grupos, PvP narrativo, poses dinâmicas, animações e sonoplastia." },
              { n: "肆", t: "Jutsus & Proficiências", d: "39 classes, ranks E→S, maestria, elementos, cooldowns e jutsus médicos (Iryo)." },
              { n: "伍", t: "Missões & Biblioteca", d: "Missões comuns e especiais, NPCs de recompensa e minigames de aprendizagem." },
              { n: "陸", t: "Party & Duelos", d: "Forme times, enfrente grupos de NPCs e desafie outros players no mesmo local." },
              { n: "漆", t: "Inventário & Loja", d: "Equipe itens, use consumíveis, compre em NPCs de loja e desbloqueie slots por proficiência." },
              { n: "捌", t: "Árvore do Clã", d: "Progressão linear por rank com jutsus exclusivos do seu sangue." },
              { n: "玖", t: "Minigames", d: "Ichiraku (clique), sequência de aprendizado — recompensas diárias e habilidades." },
            ].map((s) => (
              <div key={s.n} className="scroll-panel rounded-lg p-5 sm:p-6 hover:border-gold/60 transition">
                <div className="font-display text-3xl sm:text-4xl text-gold">{s.n}</div>
                <h3 className="mt-2 text-lg sm:text-xl font-bold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="ranking" className="mt-20 sm:mt-28 text-left">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-gold text-center">
            Os 10 mais fortes
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ranking global por XP acumulado.
          </p>
          {top.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Nenhum shinobi registrado ainda. Seja o primeiro.
            </p>
          ) : (
            <ol className="mt-8 space-y-2">
              {top.map((p: TopPlayer, i: number) => {
                const pos = i + 1;
                const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;
                const highlight = pos <= 3 ? "border-gold/60 bg-card/60" : "border-border bg-card/30";
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 sm:gap-4 rounded-lg border ${highlight} p-3 sm:p-4`}
                  >
                    <div className="w-10 sm:w-14 shrink-0 text-center font-display text-lg sm:text-2xl text-gold">
                      {medal}
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full overflow-hidden bg-secondary border border-border">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.nickname} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">忍</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{p.nickname}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {villageName(p.village)}
                        {p.clan_name ? ` · ${p.clan_name}` : ""}
                        {p.rank ? ` · ${RANK_LABEL[p.rank] ?? p.rank}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-base sm:text-lg text-gold">{p.xp.toLocaleString("pt-BR")}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">XP</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-8 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10 transition"
            >
              Entrar no ranking →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
