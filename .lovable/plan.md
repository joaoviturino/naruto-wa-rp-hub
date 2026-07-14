## Diagnóstico

Investiguei uma sessão real (`Voadora`, EF 3699, dano 3699 → NPC com 3031 HP morto em 1 hit) e o código de `playerAttack` / `CombatDialog`.

Causas encontradas:

1. **UI enche energia no máximo** — ao clicar na habilidade, `onClick` executa `setEnergy(maxES)` (linha 463 de `CombatDialog.tsx`). Ou seja, por default o jogador vai gastar 20 % do pool inteiro na primeira jogada.
2. **Backend não valida `cost_percent`** — `playerAttack` aceita `energy_used` até 100000, sem checar o teto da habilidade. Se o front tiver bug/state velho, o servidor engole.
3. **Não existe defesa/mitigação** — dano = `energy × bonus_energetic × bonus_critical × maestria × poder`. Sem redutor, NPC de 3031 HP cai com um único ataque de habilidade S ou de personagem alto-nível.
4. **NPC não tem cap contra "one-shot"** — nenhuma regra impede que um golpe leve o HP direto a 0.

## Plano

### 1. Servidor (`src/lib/combat.functions.ts`)

- Recalcular `maxAllowed = floor(pool_max × cost_percent / 100)`. Se `energy_used > maxAllowed`, faz `clamp` (não erro) e registra `energy_used = maxAllowed`. Evita quebrar clientes antigos e garante o teto.
- Ler `npcs.defense` (novo campo, ver §3) e aplicar: `damage = max(1, round(rawDamage × (1 − defense/100)))`.
- Aplicar cap "anti one-shot": `damage = min(damage, ceil(npc.hp_max × maxHitPct))` — `maxHitPct` vem do NPC (novo campo `max_hit_percent`, default 50). Se o admin quiser permitir one-shot, sobe pra 100.
- Log passa a mostrar `raw` e `damage` para transparência.

### 2. UI (`src/components/chat/CombatDialog.tsx`)

- Ao selecionar habilidade, default `energy = max(1, base_cost)` (não `maxES`).
- Slider/Input já limita a `currentMaxEnergy`; mostrar hint "recomendado: base_cost".
- Mostrar defesa e cap do alvo no popup de alvo (opcional, só se `defense>0`).

### 3. Banco (`npcs`)

- `ALTER TABLE public.npcs ADD COLUMN defense int NOT NULL DEFAULT 0;` (0–90).
- `ALTER TABLE public.npcs ADD COLUMN max_hit_percent int NOT NULL DEFAULT 50;` (10–100).

### 4. Admin (`NpcManager.tsx`)

- Dois inputs novos: **Defesa (%)** e **Dano máximo por golpe (% do HP)**, com sliders 0–100.

### 5. Teste

- Rodar `bunx tsgo --noEmit`.
- Simular combate com NPC de 3000 HP, defesa 20 %, cap 40 %:
  - Voadora com energy=740 (20 % de 3699 EF) → raw=740, com defesa=592, com cap=1200 → 592 de dano (≈20 % da vida).
  - Mesma skill com bonus_energetic=2.5 → raw=1850, defesa=1480, cap=1200 → 1200 (cap atua).
- Confirmar que o servidor impede burla mesmo se o cliente enviar `energy_used` fora do teto.

## Detalhes técnicos

- Todos os campos novos têm defaults, então NPCs existentes não quebram (defesa 0, cap 50 %).
- `normalizeState` não precisa mudar (defesa é lida do NPC row a cada ataque, não persistida no state).
- Balance secundário (mudar `bonus_energetic` das skills existentes) fica fora do escopo — o admin já pode editar por skill.
