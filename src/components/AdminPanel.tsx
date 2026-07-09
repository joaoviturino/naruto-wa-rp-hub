import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { enqueueMessage, resetBotSession, requestBotQr, setUserXp, restoreEnergies } from "@/lib/admin.functions";
import { toast } from "sonner";
import { PlayerEditor } from "@/components/admin/PlayerEditor";
import { ItemManager } from "@/components/admin/ItemManager";
import { SkillManager } from "@/components/admin/SkillManager";
import { MissionManager } from "@/components/admin/MissionManager";
import { ClanTreeManager } from "@/components/admin/ClanTreeManager";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { LocationManager } from "@/components/admin/LocationManager";
import { NpcManager } from "@/components/admin/NpcManager";
import { PartyManager } from "@/components/admin/PartyManager";
import { MinigameManager } from "@/components/admin/MinigameManager";
import { NINJA_RANKS } from "@/components/admin/shared";
import { Pencil, BatteryCharging } from "lucide-react";

export function AdminPanel() {
  const [adminUserId, setAdminUserId] = useState<string>("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? "")); }, []);
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="font-display text-3xl font-black mb-6">Painel do Kage <span className="text-gold">影</span></h1>
      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="players">Jogadores</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="skills">Habilidades</TabsTrigger>
          <TabsTrigger value="missions">Missões</TabsTrigger>
          <TabsTrigger value="clans">Árvore de Clã</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
          <TabsTrigger value="npcs">NPCs</TabsTrigger>
          <TabsTrigger value="minigames">Minigames</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4"><Dashboard /></TabsContent>
        <TabsContent value="players" className="mt-4"><Players /></TabsContent>
        <TabsContent value="items" className="mt-4">{adminUserId && <ItemManager adminUserId={adminUserId} />}</TabsContent>
        <TabsContent value="skills" className="mt-4">{adminUserId && <SkillManager adminUserId={adminUserId} />}</TabsContent>
        <TabsContent value="missions" className="mt-4"><MissionManager /></TabsContent>
        <TabsContent value="clans" className="mt-4"><ClanTreeManager /></TabsContent>
        <TabsContent value="locations" className="mt-4"><LocationManager /></TabsContent>
        <TabsContent value="npcs" className="mt-4"><NpcManager /></TabsContent>
        <TabsContent value="minigames" className="mt-4"><MinigameManager /></TabsContent>
        <TabsContent value="parties" className="mt-4"><PartyManager /></TabsContent>
        <TabsContent value="admins" className="mt-4"><AdminUsers /></TabsContent>
        <TabsContent value="whatsapp" className="mt-4"><BotPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState({ players: 0, characters: 0, pending: 0 });
  useEffect(() => {
    (async () => {
      const [{ count: players }, { count: characters }, { count: pending }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("characters").select("*", { count: "exact", head: true }),
        supabase.from("outbound_messages").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setCounts({ players: players ?? 0, characters: characters ?? 0, pending: pending ?? 0 });
    })();
  }, []);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Jogadores" value={counts.players} />
      <Stat label="Personagens" value={counts.characters} />
      <Stat label="Mensagens pendentes" value={counts.pending} />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="scroll-panel rounded-lg p-6">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-4xl font-black text-gold">{value}</div>
    </div>
  );
}

function Players() {
  const [chars, setChars] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const setXpFn = useServerFn(setUserXp);
  const restoreFn = useServerFn(restoreEnergies);
  async function load() {
    const { data } = await supabase.from("characters")
      .select("id,nickname,phone_e164,village,xp,rank,user_id,clan:clans(name,rarity)")
      .order("created_at", { ascending: false });
    setChars(data ?? []);
  }
  useEffect(() => { load(); }, []);
  return (
    <>
    <div className="scroll-panel rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="text-left p-3">Nickname</th><th className="text-left p-3">Vila</th>
            <th className="text-left p-3">Clã</th><th className="text-left p-3">Patente</th>
            <th className="text-left p-3">WhatsApp</th><th className="text-left p-3">XP</th>
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
                </div>
              </td>
            </tr>
          ))}
          {chars.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum personagem ainda.</td></tr>}
        </tbody>
      </table>
    </div>
    <PlayerEditor characterId={editingId} open={open} onOpenChange={setOpen} onSaved={load} />
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

  async function load() {
    const { data: s } = await supabase.from("bot_sessions").select("*").eq("id", "default").maybeSingle();
    const { data: m } = await supabase.from("outbound_messages").select("*").order("created_at", { ascending: false }).limit(20);
    setSession(s); setMsgs(m ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("bot_admin")
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="scroll-panel rounded-lg p-6">
        <h3 className="font-display text-xl text-gold">Sessão do Bot</h3>
        <div className="mt-2 text-sm">Status: <span className={statusColor[session?.status ?? "disconnected"]}>{session?.status ?? "—"}</span></div>
        {session?.phone && <div className="text-xs text-muted-foreground">Conectado como: {session.phone}</div>}
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
          <Button onClick={async () => {
            setAsking(true);
            try { await askQr({}); toast.success("QR solicitado. Aguarde aparecer aqui."); load(); }
            catch (err: any) { toast.error(err.message); }
            finally { setAsking(false); }
          }} disabled={asking}>
            {asking ? "Solicitando..." : "Gerar QR agora"}
          </Button>
          <Button variant="outline" onClick={async () => { await reset({}); toast.success("Sessão resetada."); load(); }}>
            Resetar sessão
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">O painel renderiza o QR direto aqui, sem depender de serviço externo de imagem.</p>
      </div>

      <div className="scroll-panel rounded-lg p-6">
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

      <div className="scroll-panel rounded-lg p-6 lg:col-span-2">
        <h3 className="font-display text-xl text-gold">Últimas mensagens</h3>
        <table className="w-full text-sm mt-3">
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
