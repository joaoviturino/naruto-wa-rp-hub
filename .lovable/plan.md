## O que vai mudar

### 1. Animação de números de dano (PvE + PvP)
- Novo componente `FloatingDamage.tsx` que emite números que sobem/caem próximos ao sprite atingido (vermelho para dano, verde para cura, dourado para crítico).
- Integrar em `CombatDialog.tsx` (PvE) e `duel.$id.tsx` (PvP) usando a lista de turnos como gatilho: cada novo turno com `damage>0` dispara um número no sprite do alvo.
- CSS: keyframe `damage-float` (translate-y -60px + fade + scale) em `src/styles.css`.

### 2. Grupos de NPCs + combate multi-alvo
Schema (migration):
- `npc_groups` (id, name, description, created_at) — grupo nomeado.
- `npc_group_members` (group_id, npc_id, weight int) — quais NPCs compõem.
- `locations.spawn_group_ids uuid[]` — grupos possíveis naquela danger zone (mantém `location_npcs` como fallback individual).
- `combat_sessions.enemy_ids uuid[]` — múltiplos inimigos por sessão.
- `combat_sessions.enemy_state jsonb` — array com HP/energia/status por inimigo.

Admin:
- Aba nova em `NpcManager.tsx` — "Grupos": criar grupo, adicionar NPCs, atribuir pesos.
- Em `LocationManager.tsx` — selecionar grupos de spawn (multiselect).

Combate:
- Ao iniciar batalha em danger zone: se houver grupos → sortear 1 grupo → instanciar todos os membros como inimigos ativos.
- `CombatDialog.tsx`: renderiza array de inimigos, cada um com sua barra HP e sprite.
- Novo fluxo de turno: **1º clique** seleciona alvo (aura vermelha pulsante no selecionado), **2º clique** escolhe habilidade/ação → aplica no alvo.
- NPCs vivos atacam em sequência no turno inimigo; inimigos mortos ficam com sprite dessaturado + "K.O.".
- Vitória só quando todos os inimigos = 0 HP; recompensas somam drops de todos.

### 3. Duelo no chat (arena compartilhada)
- Remover redirect para `/duel/:id`. Duelo aceito agora fica com `status=active` e é renderizado **inline no chat** de quem estiver na mesma `current_location_id` de ambos os duelistas.
- Novo componente `chat/DuelArena.tsx` (banner grande dentro do feed do chat) que:
  - Exibe fighters, HP/energias, feed narrativo dos turnos.
  - Se `meId ∈ (challenger, opponent)` → mostra painel de ação (mesmo do PvP atual).
  - Senão → modo espectador: só assiste; botão "Parar de assistir" fecha o banner.
- `location_messages` ganha bloqueio: enquanto houver duelo `active` na location, apenas participantes conseguem enviar mensagem (RPC/policy check). Espectadores veem "Duelo em andamento — aguarde o fim para conversar".
- Ao trocar de localização, o duelo continua rolando em background para os participantes (o banner some para quem saiu). Duelistas continuam vendo o painel em qualquer chat até `finished`.
- Rota `/duel/:id` mantida como fallback direto (link antigo), mas o fluxo padrão é dentro do chat.

## Detalhes técnicos

- Migration em uma call: cria `npc_groups`, `npc_group_members`, colunas em `locations`/`combat_sessions`, policies + GRANTs, RLS.
- `combat.functions.ts.startCombat`: aceita seleção de grupo, materializa `enemy_state`.
- `combat.functions.ts.playerTurn`: recebe `target_index` além de skill/item.
- `pvp.functions.ts`: nada novo além de expor `location_id` do duelo (já existe via characters).
- Chat realtime: já assina `pvp_duels` filtrado por location dos duelistas — adicionar canal `duel_at_location_<loc>`.
- Bloqueio de mensagens durante duelo: policy `location_messages_insert` passa a checar `NOT EXISTS (select 1 from pvp_duels where status='active' and location_id=... and user não é participante)` — ou trigger BEFORE INSERT (mais simples e sem quebrar policy existente).

## Ordem de entrega

1. Migration (schema + policies).
2. Animação de dano (componente + CSS + integração PvE/PvP).
3. Grupos de NPC (admin + spawn + combate multi-alvo com target-select).
4. Duelo no chat (DuelArena + bloqueio de mensagens + espectadores).
5. Build + typecheck.