# Deploy no Railway (sem VPS) — 5 minutos

O Railway roda o bot 24/7 pra você. **Não precisa** de VPS, PM2 ou linha de comando no servidor.

## Pré-requisito: ponte /api/public/bot-bridge

A partir desta versão o bot **não usa mais a service role key**. Ele fala com o app através da ponte segura `/api/public/bot-bridge`. Você precisa configurar o mesmo segredo nos dois lados.

No seu PC, gere uma senha forte:

```bash
openssl rand -hex 32
```

Copie esse valor.

## Passo a passo

### 1. Suba a pasta `bot/` para um repositório GitHub
A forma mais fácil: no Lovable, conecte o projeto ao GitHub (menu + → GitHub → Connect project). Isso já sobe tudo, inclusive a pasta `bot/`.

### 2. Crie conta no Railway
- Acesse [railway.app](https://railway.app) e entre com o GitHub.
- Clique em **New Project → Deploy from GitHub repo** e selecione o repositório do RPG.

### 3. Configure o serviço para apontar para a pasta `bot/`
Depois que o Railway criar o serviço:
- Clique no serviço → aba **Settings**.
- Em **Root Directory**, coloque: `bot`
- Em **Start Command** (se pedir): `node index.js`
- Salve. O Railway já detecta `railway.json` + `nixpacks.toml` que eu deixei prontos aqui.

### 4. Adicione as variáveis de ambiente
Ainda no serviço, aba **Variables → New Variable**. Crie duas:

| Nome | Valor |
|---|---|
| `BOT_BRIDGE_URL` | URL publicada do RPG (ex: `https://newerashinobirevolution.lovable.app`) |
| `BOT_WEBHOOK_SECRET` | (cole o mesmo valor do passo de pré-requisito) |

### 5. Configure o segredo no Lovable
No Lovable, vá em **Project Settings → Secrets** e adicione:

| Nome | Valor |
|---|---|
| `BOT_WEBHOOK_SECRET` | (o mesmo valor usado no Railway) |

Depois **republique** o app para a ponte usar o novo segredo.

### 6. Deploy
Clique em **Deploy**. Em ~1 minuto o Railway sobe o bot.

### 7. Volte para o painel Admin do RPG
- Aba **WhatsApp** → o selo vai virar 🟢 **"Serviço online"**.
- Clique em **"Gerar QR agora"** → escaneie no WhatsApp → pronto.

A partir daí o bot roda 24/7. Se o Railway reiniciar o container, o bot volta **já conectado**, porque a sessão fica salva no banco (tabela `bot_auth_state`).

## Custo
O Railway dá US$ 5 de crédito grátis por mês. O bot consome muito menos que isso — na prática, fica de graça.

## Comandos úteis no Railway
- **Logs ao vivo**: aba **Deployments** → clique no deploy atual → **View Logs**.
- **Restart**: aba **Settings** → **Restart**.
- **Redeploy após mudar código**: já é automático — todo push no GitHub redeploya sozinho.

## Se algo der errado
- Selo continua vermelho: veja os logs no Railway. Erro mais comum é `BOT_WEBHOOK_SECRET` diferente do Lovable.
- QR não aparece: no painel Admin, clique em **"Resetar sessão"** e depois em **"Gerar QR agora"**.
