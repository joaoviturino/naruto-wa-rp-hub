# New Era Shinobi — WhatsApp Bot (Baileys)

Este é o **serviço Node** que conversa com o WhatsApp usando o fork da Itsuki do Baileys.
Ele **não roda na web da Lovable** — precisa de um host que suporte processos longos
(PC, VPS, Railway, Fly.io, Render worker, etc.).

A partir desta versão, o bot **não precisa mais da `SUPABASE_SERVICE_ROLE_KEY`**. Ele se comunica com o app através da ponte segura `/api/public/bot-bridge`, autenticada por HMAC-SHA256.

## O que ele faz

1. Conecta ao WhatsApp via QR code (aparece no painel admin da web).
2. Envia status da sessão para o banco (tabela `bot_sessions`) via ponte.
3. **Persiste as credenciais da sessão no banco** (tabela `bot_auth_state`) — se o PC reiniciar, o bot volta **já conectado**, sem precisar escanear QR de novo.
4. A cada 3s lê a fila `outbound_messages` (status = `pending`) e envia via WhatsApp.
5. Recebe mensagens dos jogadores (base pronta para você plugar comandos do RPG).

## Pré-requisitos

- Node.js **20+** instalado no PC.
- O app publicado em uma URL pública (ex: `https://newerashinobirevolution.lovable.app`).
- Uma chave compartilhada (`BOT_WEBHOOK_SECRET`) configurada em ambos os lados.

## 1) Criar o segredo compartilhado

No seu PC, gere uma senha forte:

```bash
openssl rand -hex 32
```

Copie o valor. No Lovable, vá em **Project Settings → Secrets** e adicione:

| Nome | Valor |
|------|-------|
| `BOT_WEBHOOK_SECRET` | (cole o valor gerado acima) |

Depois de ** republicar** o app, a ponte estará ativa com essa chave.

> **Importante:** o `BOT_WEBHOOK_SECRET` deve ser **exatamente igual** no app e no PC. Se você gerar outro, atualize nos dois lugares.

## 2) Rodar no seu PC

Abra o terminal, vá até a pasta `bot` e rode:

```bash
cd bot
npm install

export BOT_BRIDGE_URL="https://newerashinobirevolution.lovable.app"
export BOT_WEBHOOK_SECRET="<mesmo-valor-do-Lovable>"

npm start
```

A primeira execução mostra um **QR code no terminal** e também publica o QR no banco. Abra o painel Admin → aba WhatsApp para escanear no celular.

A sessão fica salva no **Lovable Cloud** (tabela `bot_auth_state`). Não usa mais a pasta `bot/auth_state/`; pode apagar caso ainda exista de instalações antigas.

## 3) Rodar 24/7 com PM2 (recomendado no PC)

### Instalador automático (uma linha só)

No seu PC (Linux/macOS/Windows com Git Bash):

```bash
cd bot
export BOT_BRIDGE_URL="https://newerashinobirevolution.lovable.app"
export BOT_WEBHOOK_SECRET="<mesmo-valor-do-Lovable>"
bash install.sh
```

O `install.sh`:
1. Instala dependências;
2. Salva as envs em `bot/.env` (permissão 600);
3. Instala o PM2 global se faltar;
4. Sobe o bot com `pm2 start ecosystem.config.cjs`;
5. Roda `pm2 save` + `pm2 startup systemd` — **o bot religa sozinho quando você reinicia o PC**.

A partir daí, o botão **"Gerar QR agora"** no painel Admin funciona instantaneamente: ele grava um pedido no banco, o bot (que está sempre de pé) lê em ~2s, limpa a sessão antiga e emite o QR novo.

### Comandos manuais

PM2 mantém o processo vivo, religa em qualquer crash e reinicia automaticamente quando você altera `index.js`.

```bash
cd bot
npm install
npx pm2 start ecosystem.config.cjs      # inicia
npx pm2 logs new-era-shinobi-bot        # acompanha
npx pm2 restart new-era-shinobi-bot     # reinicia manualmente
npx pm2 save && npx pm2 startup         # (Linux) auto-start no boot
```

### Configuração incluída (`ecosystem.config.cjs`):
- `autorestart: true` + backoff exponencial (`exp_backoff_restart_delay`)
- `watch: ["index.js", "bridge-client.js", "supabaseAuthState.js"]` — religa ao salvar código
- `max_memory_restart: 512M` — recicla se estourar memória
- `ignore_watch` cobrindo `auth_state/` para NÃO reiniciar quando a sessão é gravada

Dentro do bot também há reconexão automática ao WhatsApp com backoff, keep-alive de presença a cada 4 min e `defaultQueryTimeoutMs` desligado — a instância não cai mais por "Timed Out".

## 4) Windows

No Windows você pode usar:
- **PowerShell** ou **CMD** com as variáveis:
  ```powershell
  $env:BOT_BRIDGE_URL="https://newerashinobirevolution.lovable.app"
  $env:BOT_WEBHOOK_SECRET="<seu-secret>"
  npm start
  ```
- **Git Bash** para rodar `install.sh`.
- **PM2** funciona normalmente no Windows; o auto-start no boot não usa systemd, mas o PM2 pode ser configurado como serviço manualmente se desejar.

## 5) Estender o RPG in-chat

No handler `messages.upsert` você tem `msg.key.remoteJid` (JID do jogador) e o texto. A ponte pode ser estendida para enviar mensagens recebidas ao app ou você pode consultar a API do app futuramente. Hoje a base está pronta para você plugar comandos do RPG (`!ajuda`, `!ficha`, `!treinar`...).

## Segurança

- Nunca compartilhe o `BOT_WEBHOOK_SECRET`.
- Nunca commite o `.env`.
- O bot não possui mais a `SUPABASE_SERVICE_ROLE_KEY`, então perder o PC não vaza acesso total ao banco.
