import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComboSelect } from "@/components/ui/combo-select";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Trophy, Coins, Star, Crown, Package } from "lucide-react";
import { listSeasons, upsertSeason, deleteSeason, listRewards, upsertReward, deleteReward, grantBattlePassXp } from "@/lib/battle-pass.functions";

export function BattlePassManager() {
  const [userId, setUserId] = useState("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [openSeason, setOpenSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState<any | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const list = useServerFn(listSeasons);
  const remove = useServerFn(deleteSeason);

  async function load() {
    try { const data = await list({} as any); setSeasons(data as any); if (selected) setSelected((data as any[]).find((s) => s.id === selected.id) ?? null); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? "")); load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl text-gold flex items-center gap-2"><Trophy size={20} /> Temporadas ({seasons.length})</h3>
        <Button onClick={() => { setEditingSeason({ xp_per_tier: 1000, tiers_count: 50, premium_cost: 5000, active: false, starts_at: new Date().toISOString() }); setOpenSeason(true); }}>
          <Plus size={16} /> Nova temporada
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {seasons.map((s) => (
          <div key={s.id} className={`admin-card p-4 space-y-2 ${selected?.id === s.id ? "ring-2 ring-gold" : ""}`}>
            {s.banner_url && <img src={s.banner_url} alt="" className="w-full h-24 object-cover rounded-md" />}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-bold truncate">{s.name}</h4>
                  {s.active && <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold">ATIVA</span>}
                </div>
                <p className="text-xs text-muted-foreground">{s.tiers_count} tiers · {s.xp_per_tier} XP/tier · Premium: {s.premium_cost} ryō</p>
              </div>
            </div>
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelected(s)}>Ver recompensas</Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditingSeason(s); setOpenSeason(true); }}><Pencil size={14} /></Button>
              <Button size="icon" variant="ghost" onClick={async () => {
                if (!confirm(`Excluir "${s.name}"? Todo o progresso da temporada será perdido.`)) return;
                try { await remove({ data: { id: s.id } } as any); toast.success("Excluída."); load(); }
                catch (e: any) { toast.error(e.message); }
              }}><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
        {seasons.length === 0 && (
          <div className="col-span-2 admin-card p-8 text-center text-muted-foreground">
            <Trophy size={32} className="mx-auto mb-2 opacity-40" />
            Nenhuma temporada ainda. Crie a primeira!
          </div>
        )}
      </div>

      {selected && <RewardsGrid season={selected} userId={userId} />}
      <AdminGrantXp />

      <SeasonDialog open={openSeason} onOpenChange={setOpenSeason} initial={editingSeason} userId={userId} onSaved={() => { setOpenSeason(false); load(); }} />
    </div>
  );
}

function SeasonDialog({ open, onOpenChange, initial, userId, onSaved }: any) {
  const save = useServerFn(upsertSeason);
  const [f, setF] = useState<any>(initial ?? {});
  useEffect(() => { setF(initial ?? {}); }, [initial, open]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  async function handleSave() {
    try {
      await save({ data: {
        id: f.id,
        name: f.name,
        description: f.description || null,
        banner_url: f.banner_url || null,
        starts_at: f.starts_at ?? new Date().toISOString(),
        ends_at: f.ends_at || null,
        xp_per_tier: Number(f.xp_per_tier) || 1000,
        tiers_count: Number(f.tiers_count) || 50,
        premium_cost: Number(f.premium_cost) || 0,
        active: !!f.active,
      } } as any);
      toast.success("Temporada salva.");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar temporada" : "Nova temporada"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome</Label><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Label>Banner</Label>
            <div className="flex items-center gap-2">
              {f.banner_url && <img src={f.banner_url} alt="" className="w-24 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="banners" userId={userId} onUploaded={(url) => up("banner_url", url)} />
            </div>
          </div>
          <div><Label>Começa em</Label><Input type="datetime-local" value={toLocalInput(f.starts_at)} onChange={(e) => up("starts_at", new Date(e.target.value).toISOString())} /></div>
          <div><Label>Termina em (opcional)</Label><Input type="datetime-local" value={toLocalInput(f.ends_at)} onChange={(e) => up("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
          <div><Label>XP por tier</Label><Input type="number" min={1} value={f.xp_per_tier ?? 1000} onChange={(e) => up("xp_per_tier", Number(e.target.value))} /></div>
          <div><Label>Total de tiers</Label><Input type="number" min={1} max={200} value={f.tiers_count ?? 50} onChange={(e) => up("tiers_count", Number(e.target.value))} /></div>
          <div><Label>Custo Premium (ryō)</Label><Input type="number" min={0} value={f.premium_cost ?? 5000} onChange={(e) => up("premium_cost", Number(e.target.value))} /></div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Ativa</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={!!f.active} onCheckedChange={(v) => up("active", v)} />
                <span className="text-xs text-muted-foreground">Ativar desativa as outras.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function RewardsGrid({ season, userId }: { season: any; userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const list = useServerFn(listRewards);
  const remove = useServerFn(deleteReward);

  async function load() {
    try { const data = await list({ data: { season_id: season.id } } as any); setRows(data as any); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, [season.id]);

  const byTier: Record<number, { free?: any; premium?: any }> = {};
  for (const r of rows) {
    byTier[r.tier] = byTier[r.tier] ?? {};
    byTier[r.tier][r.track as "free"|"premium"] = r;
  }

  return (
    <div className="admin-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display text-lg flex items-center gap-2"><Crown size={18} className="text-gold" /> Recompensas · {season.name}</h4>
      </div>
      <div className="scroll-panel overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-2 text-left">Tier</th>
              <th className="p-2 text-left">Grátis</th>
              <th className="p-2 text-left">Premium</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: season.tiers_count }, (_, i) => i + 1).map((tier) => (
              <tr key={tier} className="border-t border-border">
                <td className="p-2 font-bold text-gold">#{tier}</td>
                <td className="p-2"><RewardCell reward={byTier[tier]?.free} onEdit={() => setEditing({ season_id: season.id, tier, track: "free", reward_type: "ryo", quantity: 100 })} onEditExisting={(r) => setEditing(r)} onDelete={async (id) => { await remove({ data: { id } } as any); load(); }} /></td>
                <td className="p-2"><RewardCell reward={byTier[tier]?.premium} premium onEdit={() => setEditing({ season_id: season.id, tier, track: "premium", reward_type: "item", quantity: 1 })} onEditExisting={(r) => setEditing(r)} onDelete={async (id) => { await remove({ data: { id } } as any); load(); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RewardDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} initial={editing} userId={userId} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function RewardCell({ reward, premium, onEdit, onEditExisting, onDelete }: any) {
  if (!reward) {
    return <Button size="sm" variant="ghost" className={premium ? "text-gold" : "text-muted-foreground"} onClick={onEdit}><Plus size={12} /> Adicionar</Button>;
  }
  const icon = reward.reward_type === "ryo" ? <Coins size={14} /> : reward.reward_type === "xp" ? <Star size={14} /> : reward.reward_type === "item" ? <Package size={14} /> : <Crown size={14} />;
  return (
    <div className="flex items-center gap-2">
      {reward.image_url ? <img src={reward.image_url} alt="" className="w-8 h-8 rounded object-cover" /> :
       reward.item?.image_url ? <img src={reward.item.image_url} alt="" className="w-8 h-8 rounded object-cover" /> :
       <div className="w-8 h-8 grid place-items-center rounded bg-secondary">{icon}</div>}
      <div className="flex-1 min-w-0 text-xs">
        <div className="font-semibold truncate flex items-center gap-1">
          {reward.reward_type === "item" ? (reward.item?.name ?? "Item") :
           reward.reward_type === "ryo" ? "Ryō" :
           reward.reward_type === "xp" ? "XP" :
           reward.title ?? "Título"}
          <span className="text-muted-foreground">×{reward.quantity}</span>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={() => onEditExisting(reward)}><Pencil size={12} /></Button>
      <Button size="icon" variant="ghost" onClick={() => onDelete(reward.id)}><Trash2 size={12} /></Button>
    </div>
  );
}

function RewardDialog({ open, onOpenChange, initial, userId, onSaved }: any) {
  const save = useServerFn(upsertReward);
  const [f, setF] = useState<any>(initial ?? {});
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { setF(initial ?? {}); }, [initial, open]);
  useEffect(() => {
    if (!open) return;
    supabase.from("items").select("id,name,image_url").order("name").then(({ data }) => setItems(data ?? []));
  }, [open]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  async function handleSave() {
    try {
      await save({ data: {
        id: f.id,
        season_id: f.season_id,
        tier: Number(f.tier),
        track: f.track,
        reward_type: f.reward_type,
        item_id: f.item_id || null,
        quantity: Number(f.quantity) || 1,
        title: f.title || null,
        image_url: f.image_url || null,
      } } as any);
      toast.success("Recompensa salva.");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Recompensa · Tier {f.tier} · {f.track === "free" ? "Grátis" : "Premium"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo</Label>
            <ComboSelect value={f.reward_type ?? "ryo"} onChange={(v) => up("reward_type", v)}
              options={[
                { value: "ryo", label: "Ryō (moeda)" },
                { value: "xp", label: "XP de personagem" },
                { value: "item", label: "Item do inventário" },
                { value: "title", label: "Título/cosmético" },
              ]} />
          </div>
          {f.reward_type === "item" && (
            <div>
              <Label>Item</Label>
              <ComboSelect value={f.item_id ?? ""} onChange={(v) => up("item_id", v)} placeholder="Selecionar item"
                options={items.map((it: any) => ({ value: it.id, label: it.name }))} />
            </div>
          )}
          {f.reward_type === "title" && (
            <div><Label>Título</Label><Input value={f.title ?? ""} onChange={(e) => up("title", e.target.value)} /></div>
          )}
          <div><Label>Quantidade</Label><Input type="number" min={1} value={f.quantity ?? 1} onChange={(e) => up("quantity", Number(e.target.value))} /></div>
          <div>
            <Label>Imagem (opcional)</Label>
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="items" userId={userId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminGrantXp() {
  const [chars, setChars] = useState<any[]>([]);
  const [charId, setCharId] = useState("");
  const [amount, setAmount] = useState<number>(500);
  const grant = useServerFn(grantBattlePassXp);

  useEffect(() => {
    supabase.from("characters").select("id, nick").order("nick").then(({ data }) => setChars(data ?? []));
  }, []);

  async function handle() {
    if (!charId) return toast.error("Selecione um personagem.");
    try { await grant({ data: { character_id: charId, amount } } as any); toast.success("XP concedido."); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="admin-card p-4 space-y-2">
      <h4 className="font-display text-lg flex items-center gap-2"><Star size={18} className="text-gold" /> Conceder XP de passe</h4>
      <p className="text-xs text-muted-foreground">Adiciona (ou subtrai, use valor negativo) XP à temporada ativa do jogador.</p>
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full">
          <Label>Personagem</Label>
          <ComboSelect value={charId} onChange={setCharId} placeholder="Selecionar" options={chars.map((c: any) => ({ value: c.id, label: c.nick }))} />
        </div>
        <div className="w-full sm:w-32"><Label>XP</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <Button onClick={handle}>Aplicar</Button>
      </div>
    </div>
  );
}