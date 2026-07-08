import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-accent blur-3xl" />
      </div>
      <main className="relative mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-gold">新時代 · New Era</p>
        <h1 className="mt-6 font-display text-5xl sm:text-7xl font-black text-foreground">
          <span className="text-blood">Shinobi</span>{" "}
          <span className="text-gold">Revolution</span>
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-lg text-muted-foreground">
          Um RPG shinobi jogado no <strong className="text-gold">WhatsApp</strong>. Aqui na web
          você cria seu personagem, sorteia seu clã, define sua vila e afinidade elemental,
          e cuida do seu inventário. Toda a aventura acontece na conversa.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Iniciar jornada
          </Link>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-md border border-border px-8 py-3 text-base font-semibold text-foreground hover:bg-secondary transition"
          >
            Como funciona
          </a>
        </div>
        <section id="como-funciona" className="mt-32 grid gap-6 sm:grid-cols-3 text-left">
          {[
            { n: "壱", t: "Crie seu shinobi", d: "Nickname, WhatsApp, vila, clã sorteado e afinidade elemental." },
            { n: "弐", t: "Ficha e inventário", d: "Bolsa ninja, equipamentos, armas, databook de skills e conhecimentos." },
            { n: "参", t: "Jogue no WhatsApp", d: "O mestre te chama por mensagem e o RPG acontece no chat." },
          ].map((s) => (
            <div key={s.n} className="scroll-panel rounded-lg p-6">
              <div className="font-display text-4xl text-gold">{s.n}</div>
              <h3 className="mt-3 text-xl font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
