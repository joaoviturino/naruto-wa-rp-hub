## Escopo

Três mudanças interligadas: nova rota de Time, cooldown de habilidades em combate, e reestruturação total de proficiências (letra + Maestria E–S).

---

## 1. Sessão /party (substitui o popup)

**Novo:** `src/routes/_authenticated/party.tsx`
- Lista membros do time (com líder marcado), status de HP/energias em tempo real
- Lista de convites pendentes (aceitar/recusar)
- Botão **"Sair do time"** (membros) — chama `leaveParty`
- Botão **"Dissolver time"** (só líder) — nova server fn `disbandParty` que apaga `parties` + `party_members` + `party_invites` do time
- Botão de atualização manual mantido
- Realtime em `characters`, `party_members`, `party_invites`

**Chat:** troca o botão que abria o `PartyPopup` por `<Link to="/party">`. Remove `PartyPopup.tsx` e a state relacionada em `chat.tsx`.

**Backend:** adiciona `disbandParty` em `src/lib/party.functions.ts` (verifica que o chamador é o líder via `requireSupabaseAuth`).

---

## 2. Cooldown de habilidades (turnos de combate)

**Migration:**
```sql
ALTER TABLE public.skills ADD COLUMN cooldown_turns int NOT NULL DEFAULT 0;
```

O estado de cooldown por combate vive no `combat_sessions.state.players[i].cooldowns: { [skill_id]: turns_remaining }` (JSON, sem schema change adicional).

**Admin (`SkillManager.tsx`):** novo campo "Cooldown (turnos)" no dialog de skill.

**Combate (`src/lib/combat.functions.ts` → `playerAttack`):**
- Antes de gastar energia: se `player.cooldowns?[skill_id] > 0` → erro "Habilidade em cooldown".
- Após o ataque: `player.cooldowns[skill_id] = skill.cooldown_turns`.
- No fim de cada turno do jogador (após ataque/turno do NPC), decrementa todos os cooldowns dele em 1 (mínimo 0).
- Análogo aplica ao NPC (`npcAttack` interno) se ele usar skills com cooldown.

**UI (`CombatDialog.tsx`):** desabilita `<option>` de skill com cooldown > 0 e mostra `(CD n)` no label; mensagem no log quando bloqueado.

---

## 3. Proficiências: Nível E–S + Maestria E–S por classe

**Modelo novo:** cada classe de `SKILL_CLASSES` (39 classes) é uma proficiência. Cada personagem tem, por classe:
- `nivel`: `E|D|C|B|A|S|null`  (grau de treino/uso)
- `maestria`: `E|D|C|B|A|S|null` (domínio da classe)

**Enum SQL:** reutiliza `SKILL_RANKS` (`E,D,C,B,A,S`). Novo enum `skill_class` com todos os 39 valores de `SKILL_CLASSES`.

**Migration (schema):**
```sql
CREATE TYPE skill_class AS ENUM ('genjutsu','ninjutsu',... /* 39 */);

-- characters.proficiencies passa a ser JSONB no formato:
--   { "<classe>": { "nivel": "C", "maestria": "B" }, ... }
-- Como já é JSONB, só migramos os dados existentes:
UPDATE public.characters SET proficiencies = '{}'::jsonb WHERE proficiencies IS NULL;

-- items/skills: substituir req_proficiency_kind + level (int) por:
ALTER TABLE public.items
  DROP COLUMN req_proficiency_kind,
  DROP COLUMN req_proficiency_level,
  ADD COLUMN req_class skill_class,
  ADD COLUMN req_nivel skill_rank,
  ADD COLUMN req_maestria skill_rank;

ALTER TABLE public.skills  -- mesmo tratamento
  DROP COLUMN req_proficiency_kind,
  DROP COLUMN req_proficiency_level,
  ADD COLUMN req_class skill_class,
  ADD COLUMN req_nivel skill_rank,
  ADD COLUMN req_maestria skill_rank;

-- Enum antigo pode ser dropado depois; deixamos por segurança.
```

**shared.ts:** exporta `PROFICIENCY_CLASSES` = `SKILL_CLASSES` (rename semântico) e helpers `rankToNum`/`numToRank`.

**PlayerEditor.tsx (admin):** tabela com 3 colunas por classe: **Classe | Nível (Select E–S) | Maestria (Select E–S)**. Envia `{ character_id, proficiencies }` no novo formato.

**CharacterWizard.tsx:** durante criação, permite escolher **até 3 classes iniciais** com Nível E e Maestria E (valores default). Configurável.

**CharacterSheet.tsx:** exibe todas as classes com nível/maestria != null como badges "Katon E/D".

**Admin Skill/Item Manager:** trocam os dois Selects (`req_class` + `req_nivel` + `req_maestria`) usando `PROFICIENCY_CLASSES` e `SKILL_RANKS`.

**admin.functions.ts:**
- `upsertPlayer` schema: `proficiencies: z.record(className, z.object({ nivel: rank.nullable(), maestria: rank.nullable() })).optional()`
- `upsertSkill` / `upsertItem`: substitui os dois campos antigos pelos três novos.

**Efeito da Maestria em combate (`combat.functions.ts` → `playerAttack`):**
- Após calcular dano da skill: se personagem tem `maestria[skill.class]`, aplica bônus multiplicativo:
  - E: ×1.00, D: ×1.05, C: ×1.10, B: ×1.20, A: ×1.35, S: ×1.55
- Também soma bônus de acerto crítico proporcional ao Nível (E:+0, D:+1, ..., S:+5).

---

## Detalhes técnicos

**Ordem de execução:**
1. Migration schema (skills.cooldown_turns + skill_class enum + req_class/req_nivel/req_maestria em skills e items).
2. Após aprovação, atualizar `admin.functions.ts`, `shared.ts`, admin UIs, wizard, sheet, combate, party route/fn.
3. Remover `PartyPopup.tsx` e referências.

**Compatibilidade:** proficiências antigas em `characters.proficiencies` no formato `{kind: number}` ficam ignoradas (viram objeto vazio quando o admin salvar). Não há dado crítico a preservar (jogo em desenvolvimento).

**Arquivos tocados (~14):**
- Migração SQL nova
- `src/lib/party.functions.ts`, `src/lib/combat.functions.ts`, `src/lib/admin.functions.ts`
- `src/routes/_authenticated/party.tsx` (novo), `src/routes/_authenticated/chat.tsx`
- `src/components/admin/{shared.ts,PlayerEditor.tsx,SkillManager.tsx,ItemManager.tsx}`
- `src/components/{CharacterSheet.tsx,CharacterWizard.tsx,chat/CombatDialog.tsx}`
- Deletar `src/components/chat/PartyPopup.tsx`
