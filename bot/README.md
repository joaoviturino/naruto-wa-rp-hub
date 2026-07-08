# New Era Shinobi — WhatsApp Bot (Baileys)

Este é o **serviço Node** que conversa com o WhatsApp usando o fork da Itsuki do Baileys.
Ele **não roda na web da Lovable** — precisa de um host que suporte processos longos
e sockets persistentes (VPS, Railway, Fly.io, Render worker, etc.).

## O que ele faz

1. Conecta ao WhatsApp via QR code (aparece no painel admin da web).
2. Salva o status da sessão no banco (tabela `bot_sessions`).
3. A cada 3s lê a fila `outbound_messages` (status = `pending`) e envia via WhatsApp.
4. Recebe mensagens dos jogadores (base pronta para você plugar comandos do RPG).

## Rodar localmente

```bash
cd bot
npm install

export SUPABASE_URL="https://<seu-projeto>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

npm start
```

> **Onde pegar as chaves:** no painel do Lovable Cloud (ou dashboard do Supabase) — não são as chaves publishable. Guarde a service role em segredo, nunca commite.

A primeira execução mostra um **QR code no terminal** e também publica o QR no banco. Abra o painel Admin → aba WhatsApp para escanear no celular.

A sessão fica salva em `bot/auth_state/` — não commite essa pasta.

## Deploy sugerido (Railway/Fly/VPS)

- Defina as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no host.
- Rode `npm install && npm start`.
- Se possível, monte um **volume persistente** em `/app/auth_state` para não precisar reautenticar após reinícios.

## Estender o RPG in-chat

No handler `messages.upsert` você tem `msg.key.remoteJid` (JID do jogador) e o texto. Faça `supabase.from("characters").select().eq("phone_e164", ...)` para identificar quem enviou e responder com base no estado do jogo.