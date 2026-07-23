import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClanMembers, setClanRole, kickFromClan, leaveClan, CLAN_ROLE_META, type ClanRole,
} from "@/lib/clan.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Crown, Shield, Users, LogOut, UserMinus, ChevronUp, ChevronDown, GitBranch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clan")({ component: ClanPage });

const ORDER: ClanRole[] = ["lider", "vice", "anciao", "elite", "membro"];

function ClanPage() {
  const load = useServerFn(getClanMembers);
  const setRole = useServerFn(setClanRole);
  const kick = useServerFn(kickFromClan);
  const leave = useServerFn(leaveClan);
  const [state, setState] = useState<any>(null);

  const reload = useCallback(async () => setState(await load({ data: {} })), [load]);
  useEffect(() => { reload(); }, [reload]);

  if (!state) return <div className="p-6 text-center text-muted-foreground">Carregando…</div>;
  if (!state.clan) return (
    <div className="p-6 text-center text-muted-foreground">
      Você não pertence a nenhum clã.
    </div>
  );

  const canManage: boolean = state.can_manage;
  const isAdminMod: boolean = state.is_admin_mod;

  async function change(id: string, role: ClanRole) {
    try { await setRole({ data: { character_id: id, role } }); toast.success("Papel atualizado"); reload(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function onKick(id: string, name: string) {
    if (!confirm(`Expulsar ${name} do clã?`)) return;
    try { await kick({ data: { character_id: id } }); toast.success("Expulso"); reload(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function onLeave() {
    if (!confirm("Tem certeza que quer sair do clã?")) return;
    try { await leave(); toast.success("Você saiu do clã"); reload(); }
    catch (e: any) { toast.error(e.message); }
  }

  // Agrupar por papel
  const grouped = ORDER.map((r) => ({
    role: r, meta: CLAN_ROLE_META[r],
    list: (state.members as any[]).filter((m) => m.clan_role === r),
  }));

  function nextRoleUp(current: ClanRole): ClanRole | null {
    const i = ORDER.indexOf(current);
    // Líder só pode promover até vice (não pode criar outro líder)
    if (!isAdminMod && i - 1 <= 0) return i > 1 ? ORDER[i - 1] : null;
    return i > 0 ? ORDER[i - 1] : null;
  }
  function nextRoleDown(current: ClanRole): ClanRole | null {
    const i = ORDER.indexOf(current);
    return i < ORDER.length - 1 && current !== "lider" ? ORDER[i + 1] : null;
  }

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold flex items-center gap-2">
            <Crown size={22} /> {state.clan.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Hierarquia do clã · {(state.members as any[]).length} membros
            {state.my_role && (
              <> · Você é <span className={CLAN_ROLE_META[state.my_role as ClanRole].color}>
                {CLAN_ROLE_META[state.my_role as ClanRole].label}
              </span></>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/clan-tree" className="text-xs text-gold hover:underline inline-flex items-center gap-1">
            <GitBranch size={14} /> Árvore
          </a>
          {state.my_role && state.my_role !== "lider" && (
            <Button variant="outline" size="sm" onClick={onLeave}>
              <LogOut size={14} className="mr-1" /> Sair do clã
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {grouped.map(({ role, meta, list }) => (
          <section key={role} className="rounded-lg border border-border bg-card/60 p-3">
            <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
              {role === "lider" ? <Crown size={16} /> : role === "vice" ? <Shield size={16} /> : <Users size={16} />}
              <h2 className="font-semibold uppercase tracking-widest text-xs">{meta.label}</h2>
              <span className="text-[10px] text-muted-foreground">({list.length})</span>
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground italic pl-1">— vazio —</p>
            ) : (
              <ul className="space-y-2">
                {list.map((m: any) => {
                  const up = nextRoleUp(m.clan_role);
                  const down = nextRoleDown(m.clan_role);
                  const canTouch = canManage && m.id !== state.my_id && (isAdminMod || m.clan_role !== "lider");
                  return (
                    <li key={m.id} className="flex items-center gap-3 p-2 rounded-md bg-background/40 hover:bg-background/70 transition">
                      <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-black/40 shrink-0">
                        {m.avatar_url && <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{m.nickname}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {m.rank ?? "estudante"} · {(m.xp ?? 0).toLocaleString("pt-BR")} XP
                        </div>
                      </div>
                      {canTouch && (
                        <div className="flex gap-1">
                          {up && (
                            <Button size="sm" variant="outline" title={`Promover a ${CLAN_ROLE_META[up].label}`}
                              onClick={() => change(m.id, up)}>
                              <ChevronUp size={14} />
                            </Button>
                          )}
                          {down && (
                            <Button size="sm" variant="outline" title={`Rebaixar a ${CLAN_ROLE_META[down].label}`}
                              onClick={() => change(m.id, down)}>
                              <ChevronDown size={14} />
                            </Button>
                          )}
                          {isAdminMod && m.clan_role !== "lider" && (
                            <Button size="sm" variant="outline" title="Transferir liderança"
                              onClick={() => change(m.id, "lider")}>
                              <Crown size={14} />
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" title="Expulsar do clã"
                            onClick={() => onKick(m.id, m.nickname)}>
                            <UserMinus size={14} />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}