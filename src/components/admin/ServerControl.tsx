import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Megaphone, Wrench, Trash2, Power, MessageSquareOff, MapPin, Gift, RotateCw, ArrowLeftRight } from "lucide-react";
import { ComboSelect } from "@/components/ui/combo-select";
import { teleportAllPlayers, setChatLock, issueGlobalReward, listGlobalRewards, reapplyGlobalReward, deleteGlobalReward } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";

type Config = {
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_image_url: string | null;
  maintenance_eta: string | null;
  actions_hotkey_enabled: boolean;
  initial_spawn_location_id: string | null;
  chat_locked: boolean;
  trade_tax_percent: number;
};

type Broadcast = {
  id: string;
  message: string;
  variant: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
};

export function ServerControl() {
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
      <MaintenanceCard />
      <BroadcastCard />
      <GlobalToolsCard />
      <GlobalRewardsCard />
      <TradeTaxCard />
    </div>
  );
}

function MaintenanceCard() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    const { data } = await supabase.from("server_config").select("*").eq("id", "main").maybeSingle();
    setCfg(data as Config | null);
  }
  useEffect(() => {
    load();
    supabase.from("locations").select("id,name").order("name").then(({ data }) => {
      setLocations(((data ?? []) as any[]).map((l) => ({ id: l.id, name: l.name })));
    });
  }, []);

  async function save(next: Partial<Config>) {
    if (!cfg) return;
    setSaving(true);
    const merged = { ...cfg, ...next };
    const { error } = await supabase
      .from("server_config")
      .update({
        maintenance_enabled: merged.maintenance_enabled,
        maintenance_title: merged.maintenance_title,
        maintenance_message: merged.maintenance_message,
        maintenance_image_url: merged.maintenance_image_url,
        maintenance_eta: merged.maintenance_eta,
        actions_hotkey_enabled: merged.actions_hotkey_enabled,
        initial_spawn_location_id: merged.initial_spawn_location_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCfg(merged);
    toast.success("Configuração salva.");
  }

  async function uploadImage(file: File) {
    const path = `maintenance/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("locations").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.storage.from("locations").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (data?.signedUrl) await save({ maintenance_image_url: data.signedUrl });
  }

  if (!cfg) return <div className="scroll-panel rounded-lg p-6">Carregando...</div>;

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-gold flex items-center gap-2"><Wrench size={18} /> Modo Manutenção</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${cfg.maintenance_enabled ? "text-red-400" : "text-emerald-400"}`}>
            {cfg.maintenance_enabled ? "BLOQUEADO" : "ABERTO"}
          </span>
          <Switch checked={cfg.maintenance_enabled} onCheckedChange={(v) => save({ maintenance_enabled: v })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Quando ligado, jogadores comuns veem a tela de bloqueio. Admins continuam acessando normalmente.
      </p>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={cfg.maintenance_title} onChange={(e) => setCfg({ ...cfg, maintenance_title: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Textarea rows={4} value={cfg.maintenance_message} onChange={(e) => setCfg({ ...cfg, maintenance_message: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Previsão de retorno</Label>
        <Input
          type="datetime-local"
          value={cfg.maintenance_eta ? new Date(cfg.maintenance_eta).toISOString().slice(0, 16) : ""}
          onChange={(e) => setCfg({ ...cfg, maintenance_eta: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>
      <div className="space-y-2">
        <Label>Banner (imagem)</Label>
        {cfg.maintenance_image_url && (
          <div className="flex items-center gap-2">
            <img src={cfg.maintenance_image_url} alt="banner" className="h-16 rounded" />
            <Button size="sm" variant="outline" onClick={() => save({ maintenance_image_url: null })}><Trash2 size={14} /></Button>
          </div>
        )}
        <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={() => save({})} disabled={saving}>Salvar textos</Button>
        <Button
          variant={cfg.maintenance_enabled ? "outline" : "default"}
          onClick={() => save({ maintenance_enabled: !cfg.maintenance_enabled })}
        >
          <Power size={14} /> {cfg.maintenance_enabled ? "Reabrir servidor" : "Bloquear servidor"}
        </Button>
      </div>

      <div className="border-t border-border pt-4 mt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-base text-gold">Hotkey de Ações</div>
            <p className="text-xs text-muted-foreground">
              Quando desligado, o botão de ações some do chat para todos os jogadores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${cfg.actions_hotkey_enabled ? "text-emerald-400" : "text-red-400"}`}>
              {cfg.actions_hotkey_enabled ? "ATIVO" : "OCULTO"}
            </span>
            <Switch
              checked={cfg.actions_hotkey_enabled}
              onCheckedChange={(v) => save({ actions_hotkey_enabled: v })}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 mt-2 space-y-2">
        <div>
          <div className="font-display text-base text-gold">Local Inicial (Spawn)</div>
          <p className="text-xs text-muted-foreground">
            Onde novos personagens nascem ao criar a ficha. Deixe vazio para nenhum spawn automático.
          </p>
        </div>
        <ComboSelect
          value={cfg.initial_spawn_location_id ?? ""}
          onChange={(v) => save({ initial_spawn_location_id: v || null })}
          options={[{ value: "", label: "— Sem spawn —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
        />
      </div>
    </div>
  );
}

function BroadcastCard() {
  const [msg, setMsg] = useState("");
  const [variant, setVariant] = useState<"info" | "warning" | "success" | "error">("info");
  const [expiresMinutes, setExpiresMinutes] = useState<string>("");
  const [list, setList] = useState<Broadcast[]>([]);

  async function load() {
    const { data } = await supabase.from("global_broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
    setList((data ?? []) as Broadcast[]);
  }
  useEffect(() => { load(); }, []);

  async function send() {
    if (!msg.trim()) return;
    const expires_at = expiresMinutes ? new Date(Date.now() + Number(expiresMinutes) * 60000).toISOString() : null;
    const { error } = await supabase.from("global_broadcasts").insert({ message: msg.trim(), variant, active: true, expires_at });
    if (error) { toast.error(error.message); return; }
    setMsg(""); setExpiresMinutes("");
    toast.success("Mensagem global enviada.");
    load();
  }

  async function toggle(b: Broadcast) {
    const { error } = await supabase.from("global_broadcasts").update({ active: !b.active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("global_broadcasts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-4">
      <h3 className="font-display text-xl text-gold flex items-center gap-2"><Megaphone size={18} /> Mensagens Globais</h3>
      <p className="text-xs text-muted-foreground">Aparece como notificação em todas as telas dos jogadores conectados.</p>

      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Aviso do Kage..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Tipo</Label>
          <ComboSelect
            value={variant}
            onChange={(v) => setVariant(v as any)}
            triggerClassName="mt-1"
            options={[
              { value: "info", label: "Info" },
              { value: "success", label: "Sucesso" },
              { value: "warning", label: "Aviso" },
              { value: "error", label: "Urgente" },
            ]}
          />
        </div>
        <div>
          <Label>Expira em (min)</Label>
          <Input type="number" min={0} value={expiresMinutes} onChange={(e) => setExpiresMinutes(e.target.value)} placeholder="opcional" />
        </div>
      </div>
      <Button onClick={send}>Disparar para todos</Button>

      <div className="pt-2 space-y-2 max-h-80 overflow-y-auto">
        {list.map((b) => (
          <div key={b.id} className={`rounded border border-border p-2 text-sm ${b.active ? "" : "opacity-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs uppercase text-muted-foreground">{b.variant} · {new Date(b.created_at).toLocaleString()}</div>
                <div className="whitespace-pre-wrap break-words">{b.message}</div>
                {b.expires_at && <div className="text-xs text-muted-foreground mt-1">Expira: {new Date(b.expires_at).toLocaleString()}</div>}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => toggle(b)}>{b.active ? "Desligar" : "Religar"}</Button>
                <Button size="sm" variant="outline" onClick={() => remove(b.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground text-sm py-4">Nenhuma mensagem enviada.</div>}
      </div>
    </div>
  );
}

function GlobalToolsCard() {
  const [cfg, setCfg] = useState<{ chat_locked: boolean } | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [targetLoc, setTargetLoc] = useState<string>("");
  const [excludeAdmins, setExcludeAdmins] = useState(true);
  const [busy, setBusy] = useState(false);
  const teleport = useServerFn(teleportAllPlayers);
  const toggleLock = useServerFn(setChatLock);

  async function load() {
    const { data } = await supabase.from("server_config").select("chat_locked").eq("id", "main").maybeSingle();
    setCfg((data as any) ?? { chat_locked: false });
  }
  useEffect(() => {
    load();
    supabase.from("locations").select("id,name").order("name").then(({ data }) => {
      setLocations(((data ?? []) as any[]).map((l) => ({ id: l.id, name: l.name })));
    });
  }, []);

  async function doToggleLock(v: boolean) {
    setBusy(true);
    try {
      await toggleLock({ data: { locked: v } });
      setCfg({ chat_locked: v });
      toast.success(v ? "Chat trancado." : "Chat liberado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar o chat.");
    } finally { setBusy(false); }
  }

  async function doTeleport() {
    if (!targetLoc) { toast.error("Escolha um local de destino."); return; }
    const name = locations.find((l) => l.id === targetLoc)?.name ?? "local";
    if (!confirm(`Teletransportar TODOS os jogadores${excludeAdmins ? " (exceto admins)" : ""} para "${name}"?`)) return;
    setBusy(true);
    try {
      const res = await teleport({ data: { locationId: targetLoc, excludeAdmins } });
      toast.success(`Teletransportado: ${(res as any)?.affected ?? 0} jogador(es).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao teletransportar.");
    } finally { setBusy(false); }
  }

  if (!cfg) return <div className="scroll-panel rounded-lg p-6">Carregando...</div>;

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-5 lg:col-span-2">
      <h3 className="font-display text-xl text-gold flex items-center gap-2"><Power size={18} /> Ferramentas Globais</h3>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareOff size={18} className="text-gold" />
            <div>
              <div className="font-display text-base text-gold">Trancar Chat Local</div>
              <p className="text-xs text-muted-foreground">Impede jogadores comuns de enviar mensagens em qualquer local. Admins ignoram a trava.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs ${cfg.chat_locked ? "text-red-400" : "text-emerald-400"}`}>
              {cfg.chat_locked ? "TRANCADO" : "LIVRE"}
            </span>
            <Switch checked={cfg.chat_locked} disabled={busy} onCheckedChange={doToggleLock} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-gold" />
          <div>
            <div className="font-display text-base text-gold">Teletransportar Todos</div>
            <p className="text-xs text-muted-foreground">Move todos os personagens de uma vez para o local escolhido.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Local de destino</Label>
          <ComboSelect
            value={targetLoc}
            onChange={(v) => setTargetLoc(v)}
            options={[{ value: "", label: "— Selecione —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-sm">Excluir administradores</div>
            <p className="text-xs text-muted-foreground">Se ligado, admins não são movidos.</p>
          </div>
          <Switch checked={excludeAdmins} onCheckedChange={setExcludeAdmins} />
        </div>
        <Button onClick={doTeleport} disabled={busy || !targetLoc} className="w-full sm:w-auto">
          {busy ? "Executando..." : "Teletransportar todos"}
        </Button>
      </div>
    </div>
  );
}

type RewardKind = "xp" | "ryo" | "skill" | "item";
type RewardRow = {
  id: string;
  kind: RewardKind;
  amount: number | null;
  skill_id: string | null;
  item_id: string | null;
  note: string | null;
  created_at: string;
  claim_count: number;
};

function GlobalRewardsCard() {
  const [kind, setKind] = useState<RewardKind>("xp");
  const [amount, setAmount] = useState<string>("100");
  const [skillId, setSkillId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [busy, setBusy] = useState(false);

  const issue = useServerFn(issueGlobalReward);
  const listFn = useServerFn(listGlobalRewards);
  const reapply = useServerFn(reapplyGlobalReward);
  const removeFn = useServerFn(deleteGlobalReward);

  async function load() {
    try {
      const res: any = await listFn({} as any);
      setRewards((res?.rewards ?? []) as RewardRow[]);
    } catch {}
  }
  useEffect(() => {
    load();
    supabase.from("skills").select("id,name").order("name").then(({ data }) =>
      setSkills(((data ?? []) as any[]).map((s) => ({ id: s.id, name: s.name }))),
    );
    supabase.from("items").select("id,name").order("name").then(({ data }) =>
      setItems(((data ?? []) as any[]).map((s) => ({ id: s.id, name: s.name }))),
    );
  }, []);

  async function submit() {
    setBusy(true);
    try {
      const payload: any = { kind, note: note || undefined };
      if (kind === "xp" || kind === "ryo") payload.amount = Math.max(1, parseInt(amount || "0", 10));
      if (kind === "skill") payload.skill_id = skillId || undefined;
      if (kind === "item") payload.item_id = itemId || undefined;
      const res: any = await issue({ data: payload });
      toast.success(`Prêmio distribuído — aplicado a ${res?.applied ?? 0}, pulado ${res?.skipped ?? 0}.`);
      setAmount("100"); setSkillId(""); setItemId(""); setNote("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao emitir prêmio.");
    } finally { setBusy(false); }
  }

  async function doReapply(id: string) {
    setBusy(true);
    try {
      const res: any = await reapply({ data: { reward_id: id } });
      toast.success(`Reaplicado — ${res?.applied ?? 0} novo(s), pulado ${res?.skipped ?? 0}.`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao reaplicar."); }
    finally { setBusy(false); }
  }

  async function doDelete(id: string) {
    if (!confirm("Remover este prêmio do histórico? (não reverte aplicações)")) return;
    setBusy(true);
    try {
      await removeFn({ data: { reward_id: id } });
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao remover."); }
    finally { setBusy(false); }
  }

  function describe(r: RewardRow): string {
    if (r.kind === "xp") return `+${r.amount} XP`;
    if (r.kind === "ryo") return `+${r.amount} Ryo`;
    if (r.kind === "skill") return `Habilidade: ${skills.find((s) => s.id === r.skill_id)?.name ?? r.skill_id}`;
    return `Item: ${items.find((i) => i.id === r.item_id)?.name ?? r.item_id}`;
  }

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-5 lg:col-span-2">
      <h3 className="font-display text-xl text-gold flex items-center gap-2"><Gift size={18} /> Prêmio Global</h3>
      <p className="text-xs text-muted-foreground">Distribua um prêmio para todos os jogadores. Personagens que já receberam ou já possuem o item/habilidade são ignorados automaticamente — sem duplicação.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <ComboSelect
            value={kind}
            onChange={(v) => setKind(v as RewardKind)}
            options={[
              { value: "xp", label: "XP" },
              { value: "ryo", label: "Ryo" },
              { value: "skill", label: "Habilidade" },
              { value: "item", label: "Item" },
            ]}
          />
        </div>
        {(kind === "xp" || kind === "ryo") && (
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
        {kind === "skill" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Habilidade</Label>
            <ComboSelect value={skillId} onChange={setSkillId}
              options={[{ value: "", label: "— Selecione —" }, ...skills.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
        )}
        {kind === "item" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Item</Label>
            <ComboSelect value={itemId} onChange={setItemId}
              options={[{ value: "", label: "— Selecione —" }, ...items.map((i) => ({ value: i.id, label: i.name }))]} />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>Nota (opcional)</Label>
          <Input placeholder="Ex.: Evento de aniversário" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
        {busy ? "Distribuindo..." : "Distribuir para todos"}
      </Button>

      <div className="space-y-2 pt-2">
        <div className="text-sm text-gold font-display">Histórico</div>
        {rewards.length === 0 && <div className="text-center text-muted-foreground text-sm py-3">Nenhum prêmio emitido.</div>}
        {rewards.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{describe(r)}</div>
              <div className="text-xs text-muted-foreground">
                {r.claim_count} recebimento(s) · {new Date(r.created_at).toLocaleString()}{r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => doReapply(r.id)} disabled={busy}>
                <RotateCw size={14} className="mr-1" /> Reaplicar
              </Button>
              <Button variant="outline" size="sm" onClick={() => doDelete(r.id)} disabled={busy}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}