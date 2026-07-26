# Push Notifications (Web Push VAPID) + PWA instalável

## O que o usuário vai perceber
- Botão "Ativar notificações" no topo do app (após aceitar permissão do navegador, funciona mesmo com a aba fechada).
- Notificação com título, corpo e ícone quando:
  - Alguém te desafia para duelo (PvP).
  - Alguém te menciona `@você` ou responde sua mensagem no chat.
  - Admin envia broadcast global ou prêmio global direcionado a você.
  - Uma tarefa admin fica atrasada / marcada como crítica (só para admins).
- Clicar na notificação abre a rota certa (duelo, chat do local, painel admin).
- App instalável (Add to Home Screen) em Android/iOS com ícone e splash.

## Backend

1. **Chaves VAPID** — gero par de chaves ECDSA P-256 e salvo como secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:admin@newerashinobirevolution.lovable.app`). A chave pública também vai para uma env `VITE_VAPID_PUBLIC_KEY` para o cliente.
2. **Migração**: tabela `push_subscriptions` (`user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`, `created_at`, `last_seen_at`) com RLS: usuário gerencia as próprias; service_role lê tudo.
3. **Server functions em `src/lib/push.functions.ts`**:
   - `subscribeToPush({ endpoint, p256dh, auth, user_agent })` — upsert por endpoint.
   - `unsubscribeFromPush({ endpoint })`.
   - `getPublicKey()` — pega VAPID pública para o cliente.
4. **Helper server-only `src/lib/push.server.ts`**:
   - `sendPushToUsers(userIds, payload)` — carrega inscrições via `supabaseAdmin`, envia via `web-push` (pacote npm compatível com Worker), remove inscrições que devolverem 404/410.
   - Payload: `{ title, body, url, tag, icon }`.
5. **Integrações (server-side, dentro dos handlers já existentes)**:
   - `pvp.functions.ts › challengeDuel` → push ao `opponent_id` com `url=/duel/{id}` (título: "⚔️ Desafio de {nick}").
   - `chat.functions.ts › sendLocationMessage` → parseia `@nickname` e `reply_to_id`, resolve `user_id` dos alvos, push com `url=/chat` (título: "💬 {nick} te mencionou").
   - `admin.functions.ts › sendGlobalReward` (existente) e `createGlobalBroadcast` → push aos usuários alvo.
   - `admin.functions.ts › createTodo`/`updateTodo` → se `urgency in ('high','critical')` ou `due_date` no passado, push aos admins/assignee.

## Frontend

1. **PWA installability** — `public/manifest.webmanifest` com nome, tema, `display: standalone`, ícones 192/512 (gero via imagegen com tema shinobi). Tags de manifest, theme-color e apple-touch-icon no `src/routes/__root.tsx`.
2. **Service worker** — `public/sw.js` com listeners `push` (renderiza `showNotification`) e `notificationclick` (abre/foca a URL do payload). Sem cache-first: só push. Guardado por `?sw=off` para desligar.
3. **Registrador** — `src/lib/push-register.ts` com wrapper que:
   - Não registra em `id-preview--*`, `preview--*`, iframes, dev, ou com `?sw=off`.
   - Só registra em produção quando o usuário clica em "Ativar notificações".
4. **UI**:
   - Componente `NotificationsToggle` (sino no header) que mostra estado (`default`/`granted`/`denied`), pede permissão, cria PushSubscription com a chave VAPID e envia para `subscribeToPush`. Botão desativar remove inscrição.
   - Insere o botão no header autenticado (perto do `TodoAlertsBell` para admins e no ChatHud para jogadores).

## Detalhes técnicos

- Usar pacote `web-push` só no server helper (import dinâmico dentro do handler). Ele funciona no Cloudflare Worker via `nodejs_compat` (usa `crypto` Web API + `fetch`).
- Payload cifrado é feito pelo `web-push`; enviamos JSON `{ title, body, url, tag }`.
- Deduplicação: usar `tag` (ex.: `duel-{id}`, `mention-{msgId}`) para não empilhar duplicados.
- Failsafe: se `web-push` lançar por endpoint expirado (404/410), DELETE da inscrição.
- iOS Safari 16.4+: só entrega push depois de o usuário instalar o app na Home Screen — vamos deixar isso claro no toast quando detectarmos iOS.

## Arquivos criados/editados

- **novos**: `supabase/migrations/*_push_subscriptions.sql`, `src/lib/push.functions.ts`, `src/lib/push.server.ts`, `src/lib/push-register.ts`, `src/components/NotificationsToggle.tsx`, `public/sw.js`, `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`.
- **editados**: `src/routes/__root.tsx` (tags manifest), `src/lib/pvp.functions.ts`, `src/lib/chat.functions.ts`, `src/lib/admin.functions.ts`, `src/routes/_authenticated/route.tsx` ou header (para incluir o toggle), `package.json` (add `web-push`).

## Fora de escopo (por enquanto)

- Cache offline do app-shell (só push + instalação).
- Notificações agendadas (cron para atrasos futuros) — se quiser, faço numa segunda leva com pg_cron chamando um endpoint `/api/public/push-scheduler`.

Aprovando, começo pela migração + geração das chaves VAPID e sigo a lista.