# Hotkey de Ações no Chat

Botão flutuante fixo no chat (canto inferior direito, acima do MissionTracker) que abre um radial/menu com 5 ações. Só **Mover-se** fica funcional agora; as demais entram como "Em breve" já visíveis para manter o layout final.

## 1. Componente `ActionHotkey.tsx` (novo, em `src/components/chat/`)

- Botão circular dourado com ícone `Zap`, tooltip "Ações".
- Ao clicar abre um popover com 5 cards:
  - **Mover-se** (ativo) → abre `TravelDialog`
  - **Cenar** (em breve, desabilitado)
  - **Usar habilidade** (em breve)
  - **Usar item** (em breve)
  - **Ver inventário** (em breve — futuramente reutiliza `InventoryView`)
- Montado dentro de `src/routes/_authenticated/chat.tsx`.

## 2. `TravelDialog.tsx` (novo)

Fluxo em 3 passos:

1. **Mapa (visualização)** — reusa o layout do `LocationMapEditor`, mas em modo leitura:
   - Sem drag, sem handles de conexão, sem modo agrupar, sem edição de posição.
   - Destaca o local atual (borda verde) e locais conectados/atingíveis (borda dourada).
   - Clique em um local → seleciona.
2. **Painel de destino** — ao selecionar mostra: nome, imagem, distância (nós de caminho mais curto via BFS nas `location_connections`) e botão **"Ir até o local"**.
3. **Tela de viagem** — dialog com contagem regressiva, barra de progresso, arte do destino e escolha do modo de transporte (feito ANTES de iniciar, no passo 2):
   - **A pé**: 30s por nó de distância.
   - **Montaria**: seleciona uma das montarias possuídas → tempo × modificador de velocidade da montaria.
   - Botão "Cancelar viagem" (volta o personagem à origem, sem penalidade nesta versão).
   - Ao terminar: chama `moveCharacter` para o destino final e fecha o dialog.

Detalhe: para permitir viajar entre locais não adjacentes, o servidor precisa aceitar o destino final. Adicionar um novo server fn `travelTo` que:
- Valida que existe caminho (BFS por `location_connections`).
- Aceita `mountId` opcional.
- Cria uma linha em `travel_sessions` com `arrives_at` calculado no servidor (fonte de verdade do tempo).
- Só atualiza `characters.current_location_id` quando `arrives_at <= now()` (via server fn `completeTravel` chamado ao final do timer, idempotente).

Enquanto viajando: bloquear envio de mensagens/combate consultando `travel_sessions` ativa. O `TravelDialog` re-sincroniza pelo `arrives_at` (não pelo relógio local), então refresh no meio da viagem retoma corretamente.

## 3. Sistema de Montaria

### DB (nova migration)

```text
mounts                       -- catálogo (admin)
  id, name, image_url, speed_multiplier (0.1–1.0), description, rank

character_mounts             -- posse
  id, character_id, mount_id, acquired_at
  unique(character_id, mount_id)

travel_sessions              -- viagem em andamento
  id, character_id, from_location_id, to_location_id,
  mount_id nullable, started_at, arrives_at, status (traveling|arrived|cancelled)
```

GRANTs para `authenticated` + `service_role`, RLS por `character.user_id = auth.uid()` (via join/has), `mounts` SELECT livre para `authenticated`.

### Admin

- Nova aba **Montarias** no `AdminPanel` → `MountManager.tsx` (CRUD: nome, imagem, multiplicador, rank, descrição).
- No `PlayerEditor.tsx`: bloco "Montarias" para conceder/remover montarias ao jogador.

### Player

- No `CharacterSheet` (ou dentro do `TravelDialog`): lista das montarias possuídas com imagem e multiplicador.

## 4. Ajustes de arquivos existentes

- `src/lib/chat.functions.ts`: `sendLocationMessage` já bloqueia por PvP; adicionar bloqueio se houver `travel_sessions` ativa.
- `src/routes/_authenticated/chat.tsx`: montar `<ActionHotkey />` e `<TravelDialog />` (portal).
- Criar `src/lib/travel.functions.ts` com `travelTo`, `completeTravel`, `cancelTravel`, `listMyMounts`.
- Criar `src/lib/mounts.functions.ts` (admin CRUD + grant/revoke).
- Reaproveitar cálculo BFS num util `src/lib/location-graph.ts`.

## 5. UX das ações "Em breve"

Cards desabilitados com badge "Em breve" e ícone próprio (`Drama`, `Sparkles`, `Package`, `Backpack`). Toast informativo ao clicar. Assim já ficam os slots definidos para futuras entregas sem reformar a UI depois.

## Notas técnicas

- Tempo é calculado no servidor (`arrives_at = now() + nodes * base_seconds / speed_multiplier`) para evitar trapaça pelo relógio do cliente.
- `TravelDialog` faz polling leve (a cada 1s local, mas o "fim" é decidido pelo `arrives_at` retornado; o `completeTravel` é chamado assim que o cliente detecta o vencimento e é idempotente).
- Chat local desta versão fica somente-leitura enquanto `travel_sessions` estiver ativa (banner "Você está viajando…").
- Não altero regras de combate/missões nesta entrega — só adiciono o bloqueio de chat/interação enquanto viaja.
