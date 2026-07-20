## Minigame: Selos de Mão (Hand Seals)

Um novo tipo de minigame `hand_seals` onde o jogador executa a sequência dos 12 selos de mão (Boi, Tigre, Coelho, Dragão, Serpente, Cavalo, Carneiro, Macaco, Galo, Cão, Javali, Rato) para "aprender" uma habilidade.

### Como funciona

1. Admin cria um minigame do tipo `hand_seals` e:
   - Escolhe **qual habilidade** será ensinada ao completar (recompensa: `learn_skill_id`)
   - Define a **sequência de selos** (arrasta/adiciona selos de uma paleta)
   - Ajusta **tempo por selo**, **tolerância de erro** e **modo** (por clique, arrasto ou timing tipo Guitar Hero)
   - Upload opcional de **imagens customizadas** para cada selo (senão usa defaults do sistema)
   - Áudio opcional de execução

2. No jogo, o jogador:
   - Vê o retrato do NPC/personagem à esquerda
   - Ao centro, o próximo selo pedido é destacado
   - Grade com os 12 selos aparece embaixo — clique/tap no correto antes do tempo acabar
   - Ao acertar todos: animação de conclusão + som + concede a habilidade selecionada
   - Ao errar acima da tolerância: falha, sem recompensa

3. Vinculável a NPCs `learning` (como o Ronin) para criar mestres de qualquer jutsu.

### Detalhes técnicos

- **Enum**: adiciona `hand_seals` ao `minigame_kind`
- **Recompensas**: estende `rewardsSchema` em `minigame.functions.ts` com `learn_skill_id: string` — no `processMinigameRun`, insere em `character_skills` (idempotente)
- **Assets dos selos**: 12 imagens padrão em `src/assets/handseals/` (geradas via imagegen, transparent PNG). Config permite override por minigame.
- **Novo componente**: `src/components/minigame/HandSealsGame.tsx` — canvas React com grid 4×3 dos selos, timer por selo, feedback visual (verde/vermelho), combo counter
- **Editor admin**: nova aba no `MinigameManager.tsx` (ou dentro do editor genérico) — dropdown de habilidade a ensinar, editor de sequência (arrastar da paleta para lista ordenada), sliders de tempo/tolerância
- **Integração**: `MinigameDialog.tsx` roteia `kind === "hand_seals"` para `<HandSealsGame />`

### Não faz parte deste plano

- Substituir o sistema de cast de jutsus em combate por selos (só ensinar).
- Multiplayer cooperativo de selos.

Aprova? Se sim, eu implemento tudo numa passada só.
