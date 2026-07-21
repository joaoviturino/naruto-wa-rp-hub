import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { enqueueMessage, resetBotSession, requestBotQr, setUserXp, restoreEnergies, resetPlayerProgress, resetAllPlayers } from "@/lib/admin.functions";
import { toast } from "sonner";
import { PlayerEditor } from "@/components/admin/PlayerEditor";
import { AdminPlayerViewer } from "@/components/admin/AdminPlayerViewer";
import { ItemManager } from "@/components/admin/ItemManager";
import { SkillManager } from "@/components/admin/SkillManager";
import { MissionManager } from "@/components/admin/MissionManager";
import { ClanTreeManager } from "@/components/admin/ClanTreeManager";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { LocationManager } from "@/components/admin/LocationManager";
import { NpcManager } from "@/components/admin/NpcManager";
import { PartyManager } from "@/components/admin/PartyManager";
import { MinigameManager } from "@/components/admin/MinigameManager";
import { LibraryManager } from "@/components/admin/LibraryManager";
import { LevelManager } from "@/components/admin/LevelManager";
import { ProficiencyManager } from "@/components/admin/ProficiencyManager";
import { ServerControl } from "@/components/admin/ServerControl";
import { MountManager } from "@/components/admin/MountManager";
import { JobManager } from "@/components/admin/JobManager";
import { TodoManager } from "@/components/admin/TodoManager";
import { TodoAlertsBell } from "@/components/admin/TodoAlertsBell";
import { SubmissionsManager } from "@/components/admin/SubmissionsManager";
import { NINJA_RANKS } from "@/components/admin/shared";
import {
  Pencil, BatteryCharging, Eye, LayoutDashboard, Users, Package, Sparkles,
  ScrollText, GitBranch, MapPin, Ghost, Gamepad2, BookOpen, TrendingUp,
  ShieldCheck, Server, MessageSquare, Award, UsersRound, Menu, X, Rabbit, RotateCcw, AlertTriangle, Briefcase, CheckSquare, Hammer,
} from "lucide-react";

type NavItem = { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; group: string };
const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Visão geral" },
  { id: "players",   label: "Jogadores", icon: Users,           group: "Comunidade" },
  { id: "parties",   label: "Parties",   icon: UsersRound,      group: "Comunidade" },
  { id: "admins",    label: "Admins",    icon: ShieldCheck,     group: "Comunidade" },
  { id: "items",     label: "Itens",     icon: Package,         group: "Conteúdo" },
  { id: "submissions", label: "Submissões", icon: Hammer,       group: "Conteúdo" },
  { id: "skills",    label: "Habilidades", icon: Sparkles,      group: "Conteúdo" },
  { id: "profs",     label: "Proficiências", icon: Award,       group: "Conteúdo" },
  { id: "missions",  label: "Missões",   icon: ScrollText,      group: "Conteúdo" },
  { id: "jobs",      label: "Empregos",  icon: Briefcase,       group: "Conteúdo" },
  { id: "clans",     label: "Árvore de Clã", icon: GitBranch,   group: "Mundo" },
  { id: "locations", label: "Locais",    icon: MapPin,          group: "Mundo" },
  { id: "npcs",      label: "NPCs",      icon: Ghost,           group: "Mundo" },
  { id: "mounts",    label: "Montarias", icon: Rabbit,          group: "Mundo" },
  { id: "minigames", label: "Minigames", icon: Gamepad2,        group: "Mundo" },
  { id: "library",   label: "Biblioteca", icon: BookOpen,       group: "Mundo" },
  { id: "levels",    label: "Níveis",    icon: TrendingUp,      group: "Sistema" },
  { id: "todos",     label: "Tarefas",   icon: CheckSquare,     group: "Sistema" },
  { id: "server",    label: "Servidor",  icon: Server,          group: "Sistema" },
  { id: "whatsapp",  label: "WhatsApp",  icon: MessageSquare,   group: "Sistema" },
];

export function AdminPanel() {
  const [adminUserId, setAdminUserId] = useState<string>("");
  const [active, setActive] = useState<string>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? "")); }, []);

  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  const current = NAV.find((n) => n.id === active) ?? NAV[0];
  const Icon = current.icon;

  return (
    <div className="admin-shell admin-scope">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/70 px-3 py-2 backdrop-blur">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md border border-border bg-secondary/40"
          aria-label="Abrir menu"
        ><Menu size={18} /></button>
        <div className="flex items-center gap-2 font-display text-lg font-black">
          <span className="text-gold">影</span>
          <span className="admin-shimmer-text">{current.label}</span>
        </div>
        <TodoAlertsBell onOpenTodos={() => setActive("todos")} />
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-4 p-3 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside
          className={
            "admin-card fixed inset-y-0 left-0 z-40 w-[280px] overflow-y-auto p-4 transition-transform lg:static lg:inset-auto lg:z-0 lg:w-full lg:h-[calc(100dvh-3rem)] lg:sticky lg:top-6 lg:translate-x-0" +
            (mobileOpen ? " translate-x-0" : " -translate-x-full")
          }
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blood to-gold text-lg font-black text-background shadow-lg">影</div>
              <div className="min-w-0">
                <div className="font-display text-lg font-black leading-tight">Painel do Kage</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Controle Total</div>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border lg:hidden"
              aria-label="Fechar"
            ><X size={16} /></button>
          </div>

          <nav className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">{g}</div>
                <ul className="flex flex-col gap-0.5">
                  {NAV.filter((n) => n.group === g).map((n) => {
                    const IconC = n.icon;
                    const isActive = n.id === active;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => { setActive(n.id); setMobileOpen(false); }}
                          className={
                            "admin-nav-item admin-nav-item-hover w-full text-left" +
                            (isActive ? " admin-nav-item-active" : "")
                          }
                        >
                          <IconC size={16} className={isActive ? "text-gold" : ""} />
                          <span className="truncate">{n.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Content */}
        <main className="min-w-0">
          <header className="mb-4 hidden items-center gap-3 lg:flex">
            <div className="admin-card admin-tile-accent grid h-11 w-11 place-items-center rounded-xl">
              <Icon size={20} className="text-gold" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black leading-none admin-shimmer-text">{current.label}</h1>
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{current.group}</p>
            </div>
            <div className="ml-auto">
              <TodoAlertsBell onOpenTodos={() => setActive("todos")} />
            </div>
          </header>

          <div key={active} className="animate-admin-rise">
            {active === "dashboard" && <Dashboard onNavigate={setActive} />}
            {active === "players" && <Players />}
            {active === "items" && adminUserId && <ItemManager adminUserId={adminUserId} />}
            {active === "submissions" && <SubmissionsManager />}
            {active === "skills" && adminUserId && <SkillManager adminUserId={adminUserId} />}
            {active === "profs" && <ProficiencyManager />}
            {active === "missions" && <MissionManager />}
            {active === "jobs" && <JobManager />}
            {active === "clans" && <ClanTreeManager />}
            {active === "locations" && <LocationManager />}
            {active === "npcs" && <NpcManager />}
            {active === "mounts" && adminUserId && <MountManager adminUserId={adminUserId} />}
            {active === "minigames" && <MinigameManager />}
            {active === "library" && <LibraryManager />}
            {active === "levels" && <LevelManager />}
            {active === "todos" && <TodoManager />}
            {active === "parties" && <PartyManager />}
            {active === "admins" && <AdminUsers />}
            {active === "server" && <ServerControl />}
            {active === "whatsapp" && <BotPanel />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [counts, setCounts] = useState({ players: 0, characters: 0, pending: 0, npcs: 0, items: 0, skills: 0, missions: 0, locations: 0 });
  const [botStatus, setBotStatus] = useState<string>("—");
  const [maintenance, setMaintenance] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      const [
        { count: players }, { count: characters }, { count: pending },
        { count: npcs }, { count: items }, { count: skills }, { count: missions }, { count: locations },
        { data: bot }, { data: srv },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("characters").select("*", { count: "exact", head: true }),
        supabase.from("outbound_messages").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("npcs").select("*", { count: "exact", head: true }),
        supabase.from("items").select("*", { count: "exact", head: true }),
        supabase.from("skills").select("*", { count: "exact", head: true }),
        supabase.from("missions").select("*", { count: "exact", head: true }),
        supabase.from("locations").select("*", { count: "exact", head: true }),
        supabase.from("bot_sessions").select("status").eq("id", "default").maybeSingle(),
        supabase.from("server_config").select("maintenance_enabled").maybeSingle(),
      ]);
      setCounts({
        players: players ?? 0, characters: characters ?? 0, pending: pending ?? 0,
        npcs: npcs ?? 0, items: items ?? 0, skills: skills ?? 0, missions: missions ?? 0, locations: locations ?? 0,
      });
      setBotStatus(bot?.status ?? "disconnected");
      setMaintenance(!!srv?.maintenance_enabled);
    })();
  }, []);

  const statusTone: Record<string, string> = {
    connected: "from-emerald-500/30 to-emerald-500/5 text-emerald-300 border-emerald-500/40",
    qr: "from-gold/30 to-gold/5 text-gold border-gold/40",
    connecting: "from-sky-500/30 to-sky-500/5 text-sky-300 border-sky-500/40",
    disconnected: "from-red-500/30 to-red-500/5 text-red-300 border-red-500/40",
  };
  const tone = statusTone[botStatus] ?? statusTone.disconnected;

  return (
    <div className="grid gap-4 md:grid-cols-6">
      <BentoStat label="Jogadores" value={counts.players} icon={Users} tone="blood" span="md:col-span-2 md:row-span-2" onClick={() => onNavigate("players")} big />
      <BentoStat label="Personagens" value={counts.characters} icon={UsersRound} span="md:col-span-2" onClick={() => onNavigate("players")} />
      <BentoStat label="Mensagens pendentes" value={counts.pending} icon={MessageSquare} span="md:col-span-2" onClick={() => onNavigate("whatsapp")} />

      <BentoStat label="NPCs" value={counts.npcs} icon={Ghost} span="md:col-span-2" onClick={() => onNavigate("npcs")} />
      <BentoStat label="Locais" value={counts.locations} icon={MapPin} span="md:col-span-2" onClick={() => onNavigate("locations")} />

      <div
        onClick={() => onNavigate("server")}
        className={`admin-card admin-card-hover md:col-span-3 cursor-pointer overflow-hidden bg-gradient-to-br ${maintenance ? "from-red-500/30 to-red-500/5 border-red-500/40" : "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40"} p-5`}
      >
        <div className="flex items-center gap-3">
          <Server size={20} className={maintenance ? "text-red-300" : "text-emerald-300"} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Servidor</span>
        </div>
        <div className={`mt-3 font-display text-2xl font-black ${maintenance ? "text-red-300" : "text-emerald-300"}`}>
          {maintenance ? "MANUTENÇÃO ATIVA" : "ONLINE"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{maintenance ? "Somente admins têm acesso agora." : "Jogadores podem jogar normalmente."}</p>
      </div>

      <div
        onClick={() => onNavigate("whatsapp")}
        className={`admin-card admin-card-hover md:col-span-3 cursor-pointer overflow-hidden bg-gradient-to-br ${tone} p-5`}
      >
        <div className="flex items-center gap-3">
          <MessageSquare size={20} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">WhatsApp Bot</span>
        </div>
        <div className="mt-3 font-display text-2xl font-black uppercase">{botStatus}</div>
        <p className="mt-1 text-xs text-muted-foreground">Status atual da sessão do bot.</p>
      </div>

      <BentoStat label="Itens" value={counts.items} icon={Package} span="md:col-span-2" onClick={() => onNavigate("items")} />
      <BentoStat label="Habilidades" value={counts.skills} icon={Sparkles} span="md:col-span-2" onClick={() => onNavigate("skills")} />
      <BentoStat label="Missões" value={counts.missions} icon={ScrollText} span="md:col-span-2" onClick={() => onNavigate("missions")} />
    </div>
  );
}

function BentoStat({
  label, value, icon: Icon, span = "", onClick, big = false, tone,
}: {
  label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }>;
  span?: string; onClick?: () => void; big?: boolean; tone?: "blood" | "gold";
}) {
  const glow = tone === "blood"
    ? "bg-gradient-to-br from-blood/25 via-blood/5 to-transparent border-blood/40"
    : "bg-gradient-to-br from-gold/20 via-gold/5 to-transparent";
  return (
    <button
      onClick={onClick}
      className={`admin-card admin-card-hover admin-tile-accent group relative overflow-hidden p-5 text-left ${span} ${tone ? glow : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/40 text-gold transition-transform group-hover:scale-110 group-hover:rotate-6">
          <Icon size={16} />
        </div>
      </div>
      <div className={`mt-3 font-display font-black leading-none ${big ? "text-6xl" : "text-4xl"} text-gold`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">Abrir →</div>
    </button>
  );
}

function Players() {
  const [chars, setChars] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const setXpFn = useServerFn(setUserXp);
  const restoreFn = useServerFn(restoreEnergies);
  const resetOne = useServerFn(resetPlayerProgress);
  const resetAll = useServerFn(resetAllPlayers);
  const [resetTarget, setResetTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [resetXp, setResetXp] = useState(true);
  const [resetInv, setResetInv] = useState(true);
  const [resetRyo, setResetRyo] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function doReset() {
    if (!resetTarget) return;
    if (!resetXp && !resetInv && !resetRyo) { toast.error("Selecione ao menos XP, Ryo ou Inventário."); return; }
    setResetting(true);
    try {
      if (resetTarget.id) {
        await resetOne({ data: { character_id: resetTarget.id, resetXp, resetInventory: resetInv, resetRyo } });
        toast.success(`${resetTarget.name} zerado.`);
      } else {
        const r: any = await resetAll({ data: { resetXp, resetInventory: resetInv, resetRyo } });
        toast.success(`Zerado para todos os jogadores${r?.affected ? ` (${r.affected} linhas)` : ""}.`);
      }
      setResetTarget(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setResetting(false); }
  }

  async function load() {
    const { data } = await supabase.from("characters")
      .select("id,nickname,phone_e164,village,xp,rank,user_id,clan:clans(name,rarity)")
      .order("created_at", { ascending: false });
    setChars(data ?? []);
  }
  useEffect(() => { load(); }, []);
  return (
    <>
    <div className="flex justify-end mb-2">
      <Button size="sm" variant="destructive"
        onClick={() => { setResetXp(true); setResetInv(true); setResetRyo(false); setResetTarget({ id: null, name: "TODOS os jogadores" }); }}>
        <AlertTriangle size={14} className="mr-1" /> Zerar TODOS
      </Button>
    </div>
    <div className="scroll-panel rounded-lg overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-secondary/50">
          <tr>
            <th className="text-left p-2 sm:p-3">Nickname</th><th className="text-left p-2 sm:p-3">Vila</th>
            <th className="text-left p-2 sm:p-3">Clã</th><th className="text-left p-2 sm:p-3">Patente</th>
            <th className="text-left p-2 sm:p-3">WhatsApp</th><th className="text-left p-2 sm:p-3">XP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {chars.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="p-3 font-semibold">{c.nickname}</td>
              <td className="p-3">{c.village}</td>
              <td className="p-3">{c.clan?.name ?? "—"}</td>
              <td className="p-3 text-xs">{NINJA_RANKS.find((r) => r.value === c.rank)?.label ?? c.rank}</td>
              <td className="p-3 text-muted-foreground">{c.phone_e164}</td>
              <td className="p-3">
                <input type="number" className="w-20 bg-input rounded px-2 py-1 text-sm" defaultValue={c.xp}
                  onBlur={async (e) => {
                    const xp = Number(e.target.value);
                    if (xp === c.xp) return;
                    try { await setXpFn({ data: { character_id: c.id, xp } }); toast.success("XP atualizado."); load(); }
                    catch (err: any) { toast.error(err.message); }
                  }} />
              </td>
              <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="outline" title="Renovar energias (EF/EM/Chakra ao máximo)"
                    onClick={async () => {
                      try { await restoreFn({ data: { character_id: c.id } }); toast.success(`Energias de ${c.nickname} renovadas.`); }
                      catch (err: any) { toast.error(err.message); }
                    }}>
                    <BatteryCharging size={14} /> Renovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(c.id); setOpen(true); }}>
                    <Pencil size={14} /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setViewingId(c.id); setViewOpen(true); }}
                    title="Ver ficha, inventário e databook do jogador">
                    <Eye size={14} /> Ver
                  </Button>
                  <Button size="sm" variant="outline" title="Zerar XP e/ou inventário"
                    onClick={() => { setResetXp(true); setResetInv(true); setResetRyo(false); setResetTarget({ id: c.id, name: c.nickname }); }}>
                    <RotateCcw size={14} /> Zerar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {chars.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum personagem ainda.</td></tr>}
        </tbody>
      </table>
    </div>
    <PlayerEditor characterId={editingId} open={open} onOpenChange={setOpen} onSaved={load} />
    <AdminPlayerViewer characterId={viewingId} open={viewOpen} onOpenChange={setViewOpen} />
    {resetTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !resetting && setResetTarget(null)}>
        <div className="scroll-panel rounded-lg max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-blood">
            <AlertTriangle size={18} /> <h3 className="font-display text-lg">Zerar progresso</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Você está prestes a zerar <b className="text-foreground">{resetTarget.name}</b>. Esta ação é irreversível.
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={resetXp} onChange={(e) => setResetXp(e.target.checked)} />
            Zerar XP (define como 0)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={resetInv} onChange={(e) => setResetInv(e.target.checked)} />
            Zerar inventário (bolsa, secundários e itens equipados)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={resetRyo} onChange={(e) => setResetRyo(e.target.checked)} />
            Zerar Ryo (define como 0)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={resetting} onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={resetting} onClick={doReset}>
              {resetting ? "Zerando…" : "Confirmar zerar"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function BotPanel() {
  const [session, setSession] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const enqueue = useServerFn(enqueueMessage);
  const reset = useServerFn(resetBotSession);
  const askQr = useServerFn(requestBotQr);
  const [asking, setAsking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const lastSeenMs = session?.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : Infinity;
  const botOnline = lastSeenMs > 0 && secondsSinceSeen < 30;

  async function load() {
    const { data: s } = await supabase.from("bot_sessions").select("*").eq("id", "default").maybeSingle();
    const { data: m } = await supabase.from("outbound_messages").select("*").order("created_at", { ascending: false }).limit(20);
    setSession(s); setMsgs(m ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`bot_admin_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_sessions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "outbound_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    let alive = true;

    async function renderQr() {
      if (session?.status !== "qr" || !session?.qr || String(session.qr).startsWith("__REQUEST_QR__")) {
        setQrDataUrl("");
        return;
      }

      try {
        const QRCode = await import("qrcode") as typeof import("qrcode") & { default?: typeof import("qrcode") };
        const toDataUrl = QRCode.toDataURL ?? QRCode.default?.toDataURL;
        if (!toDataUrl) throw new Error("QR renderer unavailable");
        const styles = getComputedStyle(document.documentElement);
        const dataUrl = await toDataUrl(session.qr, {
          width: 280,
          margin: 2,
          color: {
            dark: styles.getPropertyValue("--qr-ink").trim(),
            light: styles.getPropertyValue("--qr-surface").trim(),
          },
        });
        if (alive) setQrDataUrl(dataUrl);
      } catch {
        if (alive) setQrDataUrl("");
      }
    }

    renderQr();
    return () => { alive = false; };
  }, [session?.status, session?.qr]);

  const statusColor: Record<string,string> = { connected: "text-emerald-400", qr: "text-gold", connecting: "text-sky-400", disconnected: "text-red-400" };

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
      <div className="scroll-panel rounded-lg p-4 sm:p-6">
        <h3 className="font-display text-xl text-gold">Sessão do Bot</h3>
        <div className="mt-2 text-sm flex items-center gap-2 flex-wrap">
          <span>Status: <span className={statusColor[session?.status ?? "disconnected"]}>{session?.status ?? "—"}</span></span>
          <span className={`inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border ${botOnline ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${botOnline ? "bg-emerald-400" : "bg-red-400"}`} />
            {botOnline ? `Serviço online (${secondsSinceSeen}s atrás)` : "Serviço offline"}
          </span>
        </div>
        {session?.phone && <div className="text-xs text-muted-foreground">Conectado como: {session.phone}</div>}
        {!botOnline && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/5 p-4 text-sm">
            <div className="font-semibold text-red-400">Bot Node não está rodando no seu VPS.</div>
            <p className="mt-2 text-muted-foreground">
              O QR só aparece aqui quando o serviço em <code className="rounded bg-secondary/40 px-1">bot/</code> está de pé. No seu VPS, rode:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-emerald-300">{`cd bot
export SUPABASE_URL="https://<seu-projeto>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
bash install.sh`}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              O <code>install.sh</code> deixa o bot vivo com PM2 (religa sozinho no boot). Depois disso, o selo acima fica verde e o botão "Gerar QR agora" funciona em ~2s.
            </p>
          </div>
        )}
        {session?.status === "qr" && session?.qr && !String(session.qr).startsWith("__REQUEST_QR__") && (
          <div className="mt-4 flex flex-col items-center">
            {qrDataUrl ? (
              <img alt="QR Code do WhatsApp" src={qrDataUrl} className="qr-code-surface h-72 w-72 rounded p-2" />
            ) : (
              <div className="qr-code-surface grid h-72 w-72 place-items-center rounded p-4 text-center text-sm">Montando QR...</div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo.</p>
          </div>
        )}
        {(session?.status === "connecting" || String(session?.qr ?? "").startsWith("__REQUEST_QR__")) && (
          <div className="mt-4 rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Gerando QR novo. Assim que o WhatsApp liberar o código, ele aparece aqui automaticamente.
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <Button disabled={asking || !botOnline} onClick={async () => {
            setAsking(true);
            try { await askQr({}); toast.success("QR solicitado. Aguarde aparecer aqui."); load(); }
            catch (err: any) { toast.error(err.message); }
            finally { setAsking(false); }
          }}>
            {asking ? "Solicitando..." : "Gerar QR agora"}
          </Button>
          <Button variant="outline" onClick={async () => { await reset({}); toast.success("Sessão resetada."); load(); }}>
            Resetar sessão
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">O painel renderiza o QR direto aqui, sem depender de serviço externo de imagem.</p>
      </div>

      <div className="scroll-panel rounded-lg p-4 sm:p-6">
        <h3 className="font-display text-xl text-gold">Enviar mensagem de teste</h3>
        <div className="mt-3 space-y-3">
          <div>
            <Label>WhatsApp (E.164)</Label>
            <Input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="+5511987654321" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={async () => {
            try { await enqueue({ data: { to_phone: phone, body } }); toast.success("Mensagem enfileirada."); setBody(""); load(); }
            catch (err: any) { toast.error(err.message); }
          }}>Enfileirar</Button>
        </div>
      </div>

      <div className="scroll-panel rounded-lg p-4 sm:p-6 lg:col-span-2 overflow-x-auto">
        <h3 className="font-display text-xl text-gold">Últimas mensagens</h3>
        <table className="w-full text-sm mt-3 min-w-[560px]">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left p-2">Quando</th><th className="text-left p-2">Para</th><th className="text-left p-2">Status</th><th className="text-left p-2">Conteúdo</th></tr>
          </thead>
          <tbody>
            {msgs.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                <td className="p-2">{m.to_phone}</td>
                <td className="p-2">{m.status}</td>
                <td className="p-2 max-w-md truncate">{m.body}</td>
              </tr>
            ))}
            {msgs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma mensagem ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
