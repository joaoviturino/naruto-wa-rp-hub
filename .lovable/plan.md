# Missões com Objetivos (tipo Task)

## O que muda para você
Toda missão passa a ter uma lista de **objetivos** (não só um texto). Cada objetivo tem tipo, alvo e quantidade — dá pra empilhar quantos quiser numa missão. Enquanto o jogador joga, o progresso é contado automaticamente. Ao completar todos, ele reivindica a recompensa.

## Categorias de missão
- **Diárias** — cooldown de 24h por personagem, reaparecem.
- **Comuns** — feitas uma vez, sem cooldown, listadas até completar.
- **Especiais** — únicas / roteirizadas, com pré-requisitos (patente, nível, missão anterior).

Aba única no admin, categoria selecionada por dropdown.

## Tipos de objetivos suportados
Todos com `count` (quantas vezes) e `description` livre:

- **Derrotar NPC específico** (escolhe o NPC)
- **Derrotar grupo de NPCs** (escolhe grupo)
- **Derrotar qualquer NPC do tipo X** (agressivo, chefe, objeto…)
- **Completar minigame** (escolhe minigame — forja, confecção, sequência, limpeza)
- **Ler livro da biblioteca** (escolhe livro)
- **Chegar a um local** (escolhe local)
- **Aprender habilidade** (escolhe skill)
- **Fabricar item** (escolhe item; conta forjas/confecções)
- **Coletar item** (escolhe item, checa inventário atual)
- **Atingir patente / nível / proficiência** (rank alvo)
- **Ganhar duelo PvP** (contador de vitórias)
- **Falar com NPC** (escolhe NPC utilitário)
- **Custom / manual** (só descrição — admin marca como cumprido pela ficha do jogador)

## Recompensas expandidas
Cada missão pode conceder qualquer combinação de:
- XP, Ryo
- Itens (id + qty; já existem no seu CRUD)
- Progressão em proficiência (value + rank alvo)
- Aprendizado direto de habilidade

## Progresso automático
Uma função central `bumpMissionProgress(character_id, event)` roda depois de cada ação relevante e incrementa objetivos que batem com o evento. Ganchos que ligarei:
- Fim de combate PvE (por NPC morto)
- Fim de minigame com sucesso
- Leitura completa de livro
- Mudança de local
- Fabricação/forja (dispara junto com o minigame)
- Aprender skill (via NPC de aprendizado)
- Fim de duelo PvP (vencedor)
- Snapshot de patente/nível/proficiência (checado no login e após XP)

## Painel do jogador
Aba "Missões" (aproveitando a UI diária atual) mostra:
- Lista por categoria com barra de progresso por objetivo
- Botão "Reivindicar" quando 100 %
- Missões travadas por pré-requisito aparecem em cinza

## Estrutura técnica
- Migração: adiciona a `missions` — `category`, `objectives` (jsonb), `rewards` (jsonb), `requirements` (jsonb), `cooldown_hours`, `repeatable`. Em `character_missions` — `progress` (jsonb), `status`, `started_at`, `claimed_at`.
- Server fns novas: `bumpMissionProgress`, `startMission`, `claimMission`, `adminMarkObjective`.
- `upsertMission` aceita os novos campos com validação Zod.
- `MissionManager.tsx` ganha construtor de objetivos (linhas add/remove, selects dependentes do tipo) e editor de recompensas.
- Hooks nos pontos citados chamando `bumpMissionProgress` em fire-and-forget.

## Fora do escopo desta entrega
- Missões em cadeia complexas com escolhas (posso adicionar depois via `requirements.previous_mission_id`).
- Missões cronometradas de tempo real (deadline em minutos).
