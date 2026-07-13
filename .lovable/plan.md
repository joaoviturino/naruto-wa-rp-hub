## Árvore de Clã Visual com Buffs e Progressão

Transformar `clan_skills` (lista linear) em uma **árvore de nós** com posicionamento livre (drag), conexões (pré-requisitos) e novos tipos de nó (buffs), semelhante à imagem enviada.

### 1. Banco de dados (nova migration)

- Nova tabela `clan_tree_nodes`:
  - `id`, `clan_id`, `kind` (`skill` | `buff`)
  - `skill_id` (nullable — quando kind=skill)
  - `buff_type` (nullable enum: `hp_bonus`, `energy_bonus`, `skill_power_bonus`, `skill_cost_reduction`)
  - `buff_value` (int — ex: +50 hp, +10% dano)
  - `buff_label`, `buff_icon_url` (para exibir no card)
  - `x`, `y` (int — posição no canvas)
  - `rank_required` (rank mínimo do player, opcional)

- Nova tabela `clan_tree_edges`: `id`, `clan_id`, `from_node_id`, `to_node_id` (pré-requisito → destino).

- Nova tabela `character_clan_progress`: `character_id`, `node_id`, `unlocked_at`. Marca quais nós o jogador destravou.

- Migrar dados atuais de `clan_skills` para `clan_tree_nodes` (kind=skill, x/y auto-distribuídos, edges em cadeia mantendo a ordem `position`).

- RLS: nós/edges leitura pública autenticada; escrita apenas admin. `character_clan_progress` leitura/escrita apenas do próprio dono (via `auth.uid()`), admin full.

### 2. Server functions (`src/lib/clan-tree.functions.ts`)

- `getClanTree({ clan_id })` — retorna `{ nodes, edges }` + progresso do caller.
- `saveClanTree({ clan_id, nodes, edges })` — admin; upsert atômico (delete missing + insert/update).
- `unlockClanNode({ node_id })` — valida: player pertence ao clã, rank suficiente, todos os `from` do node já estão em `character_clan_progress`. Insere progresso e aplica efeito (HP/energy_max update na `characters` para buffs de stat; buffs de skill ficam derivados em runtime via join).
- `getMyClanBuffs({ character_id })` — agrega buffs ativos para uso em combate.

### 3. Editor admin — reescrita completa de `ClanTreeManager.tsx`

Canvas SVG/DOM com fundo estilizado:
- Nós arrastáveis (posição salva em x/y).
- Botão "+ Habilidade" abre picker de skill; "+ Buff" abre modal (tipo/valor/rótulo/ícone).
- Modo "conectar": clica no nó A → clica no nó B → cria edge. Clique na linha remove.
- Sidebar lateral com propriedades do nó selecionado (rank_required, editar buff, deletar).
- Botão "Salvar" persiste tudo via `saveClanTree`.

### 4. Player view — nova rota `_authenticated/clan-tree.tsx`

- Renderiza o mesmo canvas em modo read-only.
- Cores dos nós: verde=destravado, amarelo=disponível (pré-requisitos OK), cinza=bloqueado.
- Clicar em nó disponível → confirma e chama `unlockClanNode`.
- Painel lateral com buffs ativos totais.

### 5. Integração de combate

- Em `combat.functions.ts`, ao iniciar sessão, buscar `getMyClanBuffs` do player e aplicar:
  - `hp_bonus` → adiciona ao HP inicial do combate
  - `energy_bonus` → adiciona à energia máx
  - `skill_power_bonus` → multiplicador de dano no cálculo
  - `skill_cost_reduction` → reduz custo de habilidades

### 6. UI/UX

- Grid snap opcional (a cada 20px) para manter organizado como na referência.
- Linhas desenhadas em SVG com curva bezier suave.
- Miniaturas usam `skill.image_url` (habilidades) ou `buff_icon_url` (buffs).

### Fora do escopo desta fase

- Respec / reset de progressão (posso adicionar depois).
- Árvore com múltiplas ramificações condicionais (ex: escolha exclusiva A ou B) — por ora todos os nós disponíveis desbloqueiam independentemente se pré-requisitos OK.
