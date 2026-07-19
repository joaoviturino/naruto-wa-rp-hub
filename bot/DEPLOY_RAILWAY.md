# Deploy no Railway (sem VPS) — 5 minutos

O Railway roda o bot 24/7 pra você. **Não precisa** de VPS, PM2 ou linha de comando no servidor.

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
| `SUPABASE_URL` | `https://zaktlzhkeydeqdiuitjq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (pegue no painel Cloud → Advanced settings → Service Role Key) |

### 5. Deploy
Clique em **Deploy**. Em ~1 minuto o Railway sobe o bot.

### 6. Volte para o painel Admin do RPG
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
- Selo continua vermelho: veja os logs no Railway. Erro mais comum é `SUPABASE_SERVICE_ROLE_KEY` errada.
- QR não aparece: no painel Admin, clique em **"Resetar sessão"** e depois em **"Gerar QR agora"**.