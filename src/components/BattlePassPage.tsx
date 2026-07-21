import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Coins, Star, Crown, Package, Lock, Check, Sparkles } from "lucide-react";
import { getMyBattlePass, buyBattlePassPremium, claimBattlePassReward } from "@/lib/battle-pass.functions";

export function BattlePassPage() {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const get = useServerFn(getMyBattlePass);
  const buy = useServerFn(buyBattlePassPremium);
  const claim = useServerFn(claimBattlePassReward);

  async function load() {
    setLoading(true);
    try { const data = await get({} as any); setState(data); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!state?.season) return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <Trophy size={48} className="mx-auto mb-3 text-muted-foreground/50" />
      <h1 className="font-display text-2xl font-black">Nenhuma temporada ativa</h1>
      <p className="text-sm text-muted-foreground mt-2">Aguarde a próxima temporada do Passe de Batalha.</p>
    </div>
  );

  const { season, character, rewards, progress, claims } = state;
  const claimedSet = new Set(claims.map((c: any) => `${c.tier}:${c.track}`));
  const currentTier = Math.floor((progress?.xp ?? 0) / season.xp_per_tier);
  const nextTier = Math.min(currentTier + 1, season.tiers_count);
  const xpInTier = (progress?.xp ?? 0) - currentTier * season.xp_per_tier;
  const pct = Math.min(100, (xpInTier / season.xp_per_tier) * 100);

  const byTier: Record<number, { free?: any; premium?: any }> = {};
  for (const r of rewards) { byTier[r.tier] = byTier[r.tier] ?? {}; byTier[r.tier][r.track as "free"|"premium"] = r; }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border">
        {season.banner_url && <img src={season.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative bg-gradient-to-br from-background/70 via-background/60 to-background/80 p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-gold flex items-center gap-2"><Trophy size={14} /> Temporada</div>
              <h1 className="font-display text-3xl sm:text-4xl font-black">{season.name}</h1>
              {season.description && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{season.description}</p>}
            </div>
            {!progress?.is_premium && (
              <button
                onClick={async () => {
                  if (!confirm(`Comprar Premium por ${season.premium_cost} ryō?`)) return;
                  try { await buy({} as any); toast.success("Premium ativado!"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }}
                className="rounded-xl bg-gradient-to-r from-gold to-blood px-4 py-3 font-display font-black text-background shadow-lg hover:brightness-110 flex items-center gap-2"
              >
                <Crown size={18} /> Comprar Premium · {season.premium_cost}<Coins size={14} />
              </button>
            )}
            {progress?.is_premium && (
              <div className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 font-display font-black text-gold flex items-center gap-2">
                <Crown size={18} /> PREMIUM ATIVO
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Tier {currentTier} / {season.tiers_count}</span>
              <span className="text-muted-foreground">{xpInTier} / {season.xp_per_tier} XP para o Tier {nextTier}</span>
            </div>
            <div className="h-3 rounded-full bg-secondary/50 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold via-blood to-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tiers grid */}
      <div className="scroll-panel overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[720px] p-3">
          <div className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center pb-2 border-b border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground text-center">Tier</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground text-center">Grátis</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground text-center flex items-center justify-center gap-1"><Crown size={12} className="text-gold" /> Premium</div>
          </div>
          {Array.from({ length: season.tiers_count }, (_, i) => i + 1).map((tier) => {
            const unlocked = tier <= currentTier;
            return (
              <div key={tier} className={`grid grid-cols-[80px_1fr_1fr] gap-2 items-center py-2 border-b border-border/50 ${unlocked ? "" : "opacity-60"}`}>
                <div className="text-center">
                  <div className={`inline-grid h-10 w-10 place-items-center rounded-full font-display font-black ${unlocked ? "bg-gradient-to-br from-gold to-blood text-background" : "bg-secondary text-muted-foreground"}`}>{tier}</div>
                </div>
                <RewardSlot reward={byTier[tier]?.free} unlocked={unlocked} claimed={claimedSet.has(`${tier}:free`)} onClaim={async () => {
                  try { await claim({ data: { tier, track: "free" } } as any); toast.success("Recompensa resgatada!"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }} />
                <RewardSlot reward={byTier[tier]?.premium} unlocked={unlocked && progress?.is_premium} lockedByPremium={!progress?.is_premium} claimed={claimedSet.has(`${tier}:premium`)} onClaim={async () => {
                  try { await claim({ data: { tier, track: "premium" } } as any); toast.success("Recompensa resgatada!"); load(); }
                  catch (e: any) { toast.error(e.message); }
                }} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground pb-8">
        Ryō atual: <span className="text-gold font-bold">{character.ryo ?? 0}</span> · XP no passe: <span className="text-gold font-bold">{progress?.xp ?? 0}</span>
      </div>
    </div>
  );
}

function RewardSlot({ reward, unlocked, claimed, onClaim, lockedByPremium }: any) {
  if (!reward) return <div className="text-center text-xs text-muted-foreground py-2">—</div>;
  const icon = reward.reward_type === "ryo" ? <Coins size={18} className="text-gold" />
    : reward.reward_type === "xp" ? <Star size={18} className="text-gold" />
    : reward.reward_type === "item" ? <Package size={18} className="text-gold" />
    : <Sparkles size={18} className="text-gold" />;
  const img = reward.image_url ?? reward.item?.image_url;
  const label = reward.reward_type === "item" ? (reward.item?.name ?? "Item")
    : reward.reward_type === "ryo" ? "Ryō"
    : reward.reward_type === "xp" ? "XP"
    : (reward.title ?? "Título");
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-2 ${claimed ? "border-emerald-500/40 bg-emerald-500/10" : unlocked ? "border-gold/40 bg-gold/5" : "border-border bg-secondary/30"}`}>
      {img ? <img src={img} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 grid place-items-center rounded bg-secondary">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground">×{reward.quantity}</div>
      </div>
      {claimed ? (
        <div className="rounded-full bg-emerald-500/20 text-emerald-300 p-1"><Check size={14} /></div>
      ) : unlocked ? (
        <Button size="sm" onClick={onClaim}>Resgatar</Button>
      ) : (
        <div className="text-muted-foreground" title={lockedByPremium ? "Precisa do Premium" : "Nível insuficiente"}><Lock size={14} /></div>
      )}
    </div>
  );
}