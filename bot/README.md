# New Era Shinobi — WhatsApp Bot (Baileys)

Este é o **serviço Node** que conversa com o WhatsApp usando o fork da Itsuki do Baileys.
Ele **não roda na web da Lovable** — precisa de um host que suporte processos longos
e sockets persistentes (VPS, Railway, Fly.io, Render worker, etc.).

## O que ele faz

1. Conecta ao WhatsApp via QR code (aparece no painel admin da web).
2. Salva o status da sessão no banco (tabela `bot_sessions`).
3. **Persiste as credenciais da sessão no banco** (tabela `bot_auth_state`) —
   se o VPS reiniciar, redeploy acontecer ou o PM2 religar o processo, o bot
   volta **já conectado**, sem precisar escanear QR de novo.
4. A cada 3s lê a fila `outbound_messages` (status = `pending`) e envia via WhatsApp.
5. Recebe mensagens dos jogadores (base pronta para você plugar comandos do RPG).

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

A sessão fica salva no **Lovable Cloud** (tabela `bot_auth_state`). Não usa mais
a pasta `bot/auth_state/`; pode apagar caso ainda exista de instalações antigas.

## Rodar 24/7 com PM2 (recomendado)

### Instalador automático (uma linha só)

No seu VPS (ou qualquer host Linux/macOS com Node 20+):

```bash
cd bot
export SUPABASE_URL="https://<seu-projeto>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
bash install.sh
```

O `install.sh`:
1. Instala dependências;
2. Salva as envs em `bot/.env` (permissão 600);
3. Instala o PM2 global se faltar;
4. Sobe o bot com `pm2 start ecosystem.config.cjs`;
5. Roda `pm2 save` + `pm2 startup systemd` — **o bot religa sozinho até quando você reinicia a máquina**.

A partir daí, o botão **"Gerar QR agora"** no painel Admin funciona instantaneamente: ele grava um pedido no banco, o bot (que está sempre de pé) lê em ~2s, limpa a sessão antiga e emite o QR novo.

### Comandos manuais

PM2 mantém o processo vivo, religa em qualquer crash e reinicia automaticamente
quando você altera `index.js`.

```bash
cd bot
npm install
npx pm2 start ecosystem.config.cjs      # inicia
npx pm2 logs new-era-shinobi-bot        # acompanha
npx pm2 restart new-era-shinobi-bot     # reinicia manualmente
npx pm2 save && npx pm2 startup         # (VPS Linux) auto-start no boot
```

> **Por que não posso iniciar o PM2 clicando no botão da web?**
> O painel roda no navegador e a Lovable Cloud não tem acesso ao seu VPS. O bot precisa rodar num host seu (VPS/Railway/Fly), e o PM2 garante que ele nunca morra. Uma vez instalado com `install.sh`, o botão sempre encontra o bot vivo.

Configuração incluída (`ecosystem.config.cjs`):
- `autorestart: true` + backoff exponencial (`exp_backoff_restart_delay`)
- `watch: ["index.js"]` — religa ao salvar código
- `max_memory_restart: 512M` — recicla se estourar memória
- `ignore_watch` cobrindo `auth_state/` para NÃO reiniciar quando a sessão é gravada

Dentro do bot também há reconexão automática ao WhatsApp com backoff, keep-alive
de presença a cada 4 min e `defaultQueryTimeoutMs` desligado — a instância não
cai mais por "Timed Out".

## Deploy sugerido (Railway/Fly/VPS)

- Defina as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no host.
- Rode `npm install && npm start`.
- Se possível, monte um **volume persistente** em `/app/auth_state` para não precisar reautenticar após reinícios.

## Estender o RPG in-chat

No handler `messages.upsert` você tem `msg.key.remoteJid` (JID do jogador) e o texto. Faça `supabase.from("characters").select().eq("phone_e164", ...)` para identificar quem enviou e responder com base no estado do jogo.