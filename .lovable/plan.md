# Sistema de Minigames — Fase 1: Limpeza do Ichiraku

## Visão geral
- Nova aba **Minigames** no painel admin: cadastro genérico de minigames (tipo, imagens, diálogos, recompensas, cooldown) + habilitação por local.
- Em **Locais**, novo bloco "Minigames ativos" (multi-select) — igual ao padrão da Danger Zone.
- No **Chat**, quando o local tem minigame ativo E o cooldown do player expirou, aparece botão **Iniciar Missão**.
- Fluxo do jogo: popup fullscreen → diálogo de abertura (dono) → tela de limpeza → diálogo de agradecimento → recompensas concedidas → cooldown iniciado.
- Na **ficha do personagem**: painel "Missões Diárias" listando cada minigame já jogado com contador regressivo para o próximo uso.

## Estrutura de dados (nova migration)

Tabela `minigames`:
- `id`, `slug` (único, ex.: `ichiraku_cleanup`), `kind` (enum: `cleanup` por enquanto), `name`, `description`
- `background_url`, `tileset_url`, `npc_portrait_url`
- `dialog_intro` (texto), `dialog_outro` (texto), `npc_name`
- `config` (jsonb): parâmetros do tipo — para `cleanup`: `{ duration_seconds, dirt_count, tools: [{ id, name, sprite_index }] }`
- `rewards` (jsonb): `{ xp, ryo, items:[{item_id, qty}] }`
- `cooldown_hours` (int, default 24)
- `active` (bool)

Tabela `location_minigames`: `location_id`, `minigame_id` (many-to-many).

Tabela `minigame_runs`: `character_id`, `minigame_id`, `completed_at`, `score`, `success`. Índice `(character_id, minigame_id, completed_at desc)` para consulta rápida do último run.

Bucket público `minigames` (imagens de fundo/tileset/retrato).

## Server functions (`src/lib/minigame.functions.ts`)
- `listMinigamesForLocation({ location_id })` — retorna minigames ativos no local + `next_available_at` do caller.
- `startMinigameRun({ minigame_id, location_id })` — valida cooldown + presença no local, retorna config e intro.
- `completeMinigameRun({ minigame_id, score, success })` — grava run, aplica recompensas (xp, ryo, itens na bolsa), devolve outro.
- Admin (com `has_role('admin')`): `upsertMinigame`, `deleteMinigame`, `setLocationMinigames`.

## Admin UI (`src/components/admin/MinigameManager.tsx`)
- Lista + editor lado a lado (padrão dos outros managers).
- Uploads das 3 imagens (fundo, tileset, retrato).
- Textareas para diálogos intro/outro + nome do NPC.
- Bloco recompensas: XP / Ryo / adicionar itens da lista.
- Cooldown em horas (24 padrão).
- Para `cleanup`: duração (s), quantidade de manchas, e lista de ferramentas do tileset (mop/vassoura/esponja com índice/sprite).
- Registrar aba em `AdminPanel.tsx`.

## LocationManager
- Novo bloco "Minigames disponíveis neste local" com checkboxes dos minigames ativos, mesma UX do bloco de NPCs.

## Chat (`src/routes/_authenticated/chat.tsx`)
- Ao carregar local, chamar `listMinigamesForLocation`.
- Botão **Iniciar Missão** (por minigame) abre `<MinigameDialog>`. Disabled + timer se em cooldown.

## Minigame runner (`src/components/minigame/MinigameDialog.tsx` + `CleanupGame.tsx`)
- Passo 1: card com retrato do NPC + diálogo intro + botão "Começar".
- Passo 2: canvas/DOM com fundo do restaurante; N manchas posicionadas aleatoriamente por cima; timer regressivo.
  - Jogador seleciona ferramenta (mop/vassoura/esponja) do tileset e clica nas manchas — cada clique remove a mancha correspondente (ferramenta certa para tipo certo → bônus; ferramenta qualquer → limpa mais devagar).
  - Score = manchas limpas / total no tempo.
- Passo 3: diálogo de outro + resumo das recompensas.

## Ficha (`CharacterSheet.tsx`)
- Nova seção "Missões Diárias": para cada minigame, mostra nome + "Disponível agora" ou "Próxima em Xh Ym Zs" (contador ao vivo). Query em `minigame_runs` + `cooldown_hours`.

## Detalhes técnicos
- Tileset como sprite sheet horizontal: recorto via `background-image` + `background-position` a partir do índice configurado.
- Manchas são divs absolutas geradas do lado do cliente (posição aleatória seedada por `run_id` só para visual — servidor não valida posição).
- Recompensas aplicadas server-side dentro de `completeMinigameRun` para evitar trapaça no front (mas score em si é confiado no cliente por enquanto — flag TODO).

## Fora do escopo desta fase
- Outros tipos de minigame (`kind`) — a estrutura já suporta, adiciono no futuro.
- Ranking/leaderboard.
- Validação anti-trapaça do score.
