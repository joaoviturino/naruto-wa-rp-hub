# New Era Shinobi - Revolution — Plano do MVP

O RPG acontece no WhatsApp. A web serve para: (1) cadastrar o personagem, (2) ver ficha/inventário/databook, (3) painel admin controlar tudo e conectar o bot WhatsApp (Baileys da Itsuki).

## 1. Stack e infra
- Frontend: TanStack Start (já configurado), Tailwind v4, shadcn.
- Backend: Lovable Cloud (Supabase gerenciado) para auth, DB e storage de imagens (perfil, banner, PNG do inventário).
- Bot WhatsApp Baileys: **não roda na web** (Cloudflare Workers não suporta sockets persistentes do Baileys). Fornecerei um serviço Node separado (`/bot`) que:
  - usa `@itsukichann/baileys` (repo indicado),
  - autentica via QR code,
  - lê fila de mensagens do Supabase (tabela `outbound_messages`) e envia (mensagem de boas-vindas etc.),
  - guarda sessão local + status no Supabase (`bot_sessions`).
- A web (painel admin) mostra QR/status e enfileira mensagens. Instruções de deploy do bot ficam em `bot/README.md` (rodar em VPS/Railway/Fly — Lovable hospeda só a web).

## 2. Fluxo do jogador (web)
1. **Login/Cadastro**: email + senha (Supabase Auth).
2. **Criação de personagem** (wizard):
   1. Nickname + telefone (input numérico com máscara internacional, validado como MSISDN).
   2. Escolha da vila (Konoha, Suna, Kiri, Kumo, Iwa, além de menores — Ame, Kusa, Taki, Oto, Yuki, Hoshi).
   3. **Sorteio de clã**: pool ponderado por raridade (Comum → Lendário). Clãs top (Uchiha, Senju, Uzumaki, Hyuuga, Kaguya, Jugo etc.) têm peso muito baixo. Filtrado pela vila. Jogador tem **2 rerolls** (total 3 tentativas) — mantém o último.
   4. **Afinidade elemental**: sorteio 1 elemento base (Katon, Suiton, Fuuton, Doton, Raiton) + regra de bônus por clã (ex.: Uchiha começa Katon).
   5. **Ficha** estilo Akatsuki RPG (nome, idade, aparência, personalidade, história, ninjutsus iniciais em texto livre — habilidades reais entram pelo databook via admin).
3. Ao concluir → enfileira mensagem de boas-vindas no WhatsApp.

## 3. Modelo de dados (Supabase)
```
profiles(id=auth.uid, email, is_admin)
characters(id, user_id, nickname, phone_e164, village, clan_id, element_primary,
           bio, appearance, personality, history,
           avatar_url, banner_url, inventory_bg_url,
           xp int default 0, created_at)
clans(id, name, village, rarity enum[common,uncommon,rare,epic,legendary],
      element_bonus, description)
inventory(character_id pk, ninja_bag jsonb, secondary jsonb,   -- slots
          helmet_id, vest_id, pants_id, boots_id,
          primary_weapon_id, primary_unlocked bool,
          secondary_weapon_id, secondary_unlocked bool)
items(id, name, type enum[consumable,tool,armor_helmet,armor_vest,armor_pants,armor_boots,weapon], slot_size int, meta jsonb)
skills(id, name, rank enum[E,D,C,B,A,S], type, element, description)
character_skills(character_id, skill_id, learned_at)
knowledges(id, name, description)
character_knowledges(character_id, knowledge_id)
outbound_messages(id, to_phone, body, status enum[pending,sent,failed], created_at, sent_at)
bot_sessions(id, status enum[disconnected,qr,connected], qr text, updated_at)
audit_log(id, admin_id, action, target, meta, created_at)
user_roles(user_id, role enum[admin,user])  -- padrão has_role()
```
RLS: jogador lê/edita só seu character/inventory. Admin (via `has_role`) lê tudo. `outbound_messages` e `bot_sessions` só admin + service_role (bot usa service key).

### Bolsa ninja e slots
- **Bolsa ninja**: 20 unidades de capacidade (itens ocupam `slot_size`, ex.: shuriken=1, pergaminho=2, kunai=1, bomba=3).
- **Slots secundários**: 10 espaços fixos (1 item por espaço, itens raros/quest).
- Equipamentos: 4 slots fixos (elmo/bandana, colete, calça, botas) + arma primária (bloqueada por padrão) + arma secundária (bloqueada).
- UI do inventário: PNG do personagem centralizado, equipamentos ao redor (RPG clássico), bolsa embaixo.

## 4. Ficha / Databook
Página do personagem em abas: **Ficha** (texto livre estilo Akatsuki, sem databook clássico), **Inventário** (visual), **Databook** (habilidades por rank + conhecimentos), **Status** (XP total, EF = XP/2, EM = XP/2, Chakra = EF+EM). Sem bônus de clã ainda (campo preparado no schema).

## 5. Painel Admin (`/admin`, gate por `has_role('admin')`)
- Dashboard: nº jogadores, personagens por vila/clã, status do bot.
- CRUD: clãs, itens, skills, conhecimentos.
- Jogadores: listar, ver ficha, editar XP, dar/remover skills e itens, banir.
- **WhatsApp Bot**: mostra status (`bot_sessions`), QR code para parear, botão "reiniciar sessão", envio manual de mensagem de teste, fila `outbound_messages` com retry.
- Log de auditoria.

## 6. Serviço Baileys (pasta `/bot`, deploy separado)
- `package.json` com `@itsukichann/baileys`, `@supabase/supabase-js`, `qrcode`.
- Loop: conecta → publica QR/status no Supabase → escuta `outbound_messages` (Realtime ou polling) → envia → marca `sent`.
- README explica: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `npm start`, deploy VPS/Railway.

## 7. Escopo desta primeira entrega
Vou entregar de uma vez:
1. Habilitar Lovable Cloud + migrations (todas as tabelas acima, RLS, seed de clãs de todas as vilas e itens básicos).
2. Auth (email/senha) + rota `/auth`.
3. Wizard de criação de personagem (5 passos) com sorteio de clã e elemento.
4. Página do personagem (Ficha / Inventário / Databook / Status).
5. Painel admin completo (com abas acima).
6. Server functions: enfileirar mensagem de boas-vindas, atualizar status bot, publicar QR.
7. Pasta `/bot` com serviço Baileys pronto pra rodar + README.
8. Design system dark ninja (não roxo genérico) — vermelho sangue + preto + dourado, tipografia forte.

## 8. Fora do escopo agora (posso fazer depois)
- Combate/dados/mestre no WhatsApp (lógica de RPG in-chat).
- Bônus de XP por clã.
- Sistema de missões, economia, ryo.
- Notificações push web.

## Perguntas rápidas antes de codar
1. Confirma email/senha no login web? (ou prefere só nickname+telefone, com OTP via WhatsApp depois — mais complexo)
2. Posso seguir com a paleta ninja **preto + vermelho sangue + dourado** ou prefere outra?
3. Tudo bem o bot Baileys rodar fora da Lovable (VPS/Railway) com instruções prontas? É obrigatório pela natureza do Baileys.
