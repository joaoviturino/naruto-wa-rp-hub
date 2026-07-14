## Objetivo

Trocar animações GIF por **troca de poses** durante o combate. Admins concedem poses (imagens PNG) aos jogadores; cada jogador escolhe qual pose será exibida ao usar cada habilidade. O áudio de sonoplastia continua funcionando normalmente.

## Comportamento em combate

- Cada personagem tem uma **pose padrão** (a imagem `inventory_png_url` atual continua sendo o default).
- Ao usar uma habilidade que tenha pose vinculada, o sprite do personagem no palco troca para a pose configurada durante ~1.2s e volta ao default. Se não houver pose configurada, o sprite não muda (só toca o som e mostra o número de dano).
- O som (`skills.sound_url`) continua tocando exatamente como hoje.
- Vale para jogador e aliados; NPCs seguem usando o sprite atual (fora do escopo).

## Mudanças no banco

1. Nova tabela `character_poses`
   - `id`, `character_id` (FK), `name` (texto curto, ex.: "Selo de Tigre"), `image_url`, `sort_order`, timestamps.
   - RLS: dono e admin leem; só admin insere/atualiza/deleta. Grants padrão.
2. Nova tabela `character_skill_poses` (mapeamento pose ↔ habilidade por jogador)
   - `character_id`, `skill_id`, `pose_id` (FK → character_poses), PK composta.
   - RLS: dono lê/edita as próprias; admin lê/edita tudo.
3. Deprecar `skills.animation_url`: manter a coluna por compat, mas remover da UI de skill (não é mais editada). Backend deixa de emitir `animation_url` no log de combate.

## Mudanças no admin

- **PlayerEditor**: nova aba/seção "Poses" com CRUD (upload de imagem, nome, ordenação, remover). Reutiliza o bucket `skills` ou cria bucket `poses` (vou usar `skills` para não precisar de novo bucket).
- **SkillManager**: remover os campos "Animação (GIF/PNG/MP4)" e a lógica associada (mantém `sound_url`).

## Mudanças no jogador

- Nova tela **"Minhas Poses"** dentro da ficha (`CharacterSheet`): mostra poses concedidas pelo admin (somente leitura) e, para cada habilidade que ele conhece, um seletor "usar pose X".
- Server fn `setSkillPose({ skill_id, pose_id | null })` valida que a pose pertence ao personagem.

## Mudanças no combate

- `combat.functions.ts` `playerAttack`: no log, em vez de `animation_url` da skill, buscar `character_skill_poses` do jogador ativo e anexar `pose_url` (ou `null`) no evento. Mantém `sound_url`.
- `CombatDialog.tsx`: quando um evento do jogador vem com `pose_url`, trocar o `src` do sprite daquele slot por ~1.2s (state com timeout), depois voltar para `inventory_png_url`. Remover o overlay atual de animação (o `<img className="animate-scale-in">` sobre o palco).

## Arquivos afetados

- `supabase/migration` (nova): tabelas + policies + grants.
- `src/lib/character.functions.ts`: `listMyPoses`, `setSkillPose`, `listMySkillPoses`.
- `src/lib/admin.functions.ts`: `adminUpsertPose`, `adminDeletePose`, `adminListPoses`.
- `src/components/admin/PlayerEditor.tsx`: seção Poses.
- `src/components/admin/SkillManager.tsx`: remover campo de animação.
- `src/components/CharacterSheet.tsx` (ou novo `PoseBinder.tsx`): UI do jogador para vincular poses a jutsus.
- `src/lib/combat.functions.ts`: substituir `animation_url` por `pose_url` no log.
- `src/components/chat/CombatDialog.tsx`: renderizar pose swap em vez de overlay de animação.

## Fora do escopo

- Poses para NPCs.
- Animação/transição elaborada entre poses (troca simples com fade curto CSS já existente).
- Migração automática das `animation_url` antigas — ficam no banco mas não são mais usadas.

Confirma que posso seguir?
