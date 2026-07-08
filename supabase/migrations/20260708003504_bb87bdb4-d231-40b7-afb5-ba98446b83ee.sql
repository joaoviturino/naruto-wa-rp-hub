
create type public.app_role as enum ('admin','user');
create type public.village as enum ('konoha','suna','kiri','kumo','iwa','ame','kusa','taki','oto','yuki','hoshi','nomad');
create type public.clan_rarity as enum ('common','uncommon','rare','epic','legendary');
create type public.element as enum ('katon','suiton','fuuton','doton','raiton');
create type public.item_type as enum ('consumable','tool','armor_helmet','armor_vest','armor_pants','armor_boots','weapon_primary','weapon_secondary');
create type public.skill_rank as enum ('E','D','C','B','A','S');
create type public.msg_status as enum ('pending','sent','failed');
create type public.bot_status as enum ('disconnected','qr','connecting','connected');

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text, display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid()=id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid()=id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid()=id);

create table public.user_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id,role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid()=user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create policy "admins read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email) values (new.id, new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.clans(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  village public.village not null,
  rarity public.clan_rarity not null,
  element_bonus public.element,
  description text,
  weight int not null default 100,
  created_at timestamptz not null default now()
);
grant select on public.clans to anon, authenticated;
grant all on public.clans to service_role;
alter table public.clans enable row level security;
create policy "clans public read" on public.clans for select to anon, authenticated using (true);
create policy "clans admin write" on public.clans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.characters(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nickname text not null,
  phone_e164 text not null,
  village public.village not null,
  clan_id uuid references public.clans(id),
  element_primary public.element not null,
  age int,
  appearance text, personality text, history text, bio text,
  avatar_url text, banner_url text, inventory_bg_url text,
  xp int not null default 0,
  clan_rerolls_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.characters to authenticated;
grant all on public.characters to service_role;
alter table public.characters enable row level security;
create policy "own character read" on public.characters for select to authenticated using (auth.uid()=user_id);
create policy "own character write" on public.characters for insert to authenticated with check (auth.uid()=user_id);
create policy "own character update" on public.characters for update to authenticated using (auth.uid()=user_id);
create policy "admin all characters" on public.characters for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
create trigger characters_touch before update on public.characters for each row execute function public.touch_updated_at();

create table public.items(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type public.item_type not null,
  slot_size int not null default 1,
  description text,
  meta jsonb not null default '{}'::jsonb
);
grant select on public.items to anon, authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "items public read" on public.items for select to anon, authenticated using (true);
create policy "items admin write" on public.items for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.inventory(
  character_id uuid primary key references public.characters(id) on delete cascade,
  ninja_bag jsonb not null default '[]'::jsonb,
  secondary_slots jsonb not null default '[]'::jsonb,
  helmet_id uuid references public.items(id),
  vest_id uuid references public.items(id),
  pants_id uuid references public.items(id),
  boots_id uuid references public.items(id),
  primary_weapon_id uuid references public.items(id),
  primary_unlocked boolean not null default false,
  secondary_weapon_id uuid references public.items(id),
  secondary_unlocked boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.inventory to authenticated;
grant all on public.inventory to service_role;
alter table public.inventory enable row level security;
create policy "own inventory read" on public.inventory for select to authenticated
  using (exists (select 1 from public.characters c where c.id=inventory.character_id and c.user_id=auth.uid()));
create policy "own inventory write" on public.inventory for all to authenticated
  using (exists (select 1 from public.characters c where c.id=inventory.character_id and c.user_id=auth.uid()))
  with check (exists (select 1 from public.characters c where c.id=inventory.character_id and c.user_id=auth.uid()));
create policy "admin inventory" on public.inventory for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.skills(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rank public.skill_rank not null default 'E',
  element public.element,
  type text,
  description text
);
grant select on public.skills to anon, authenticated;
grant all on public.skills to service_role;
alter table public.skills enable row level security;
create policy "skills public read" on public.skills for select to anon, authenticated using (true);
create policy "skills admin write" on public.skills for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.character_skills(
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  learned_at timestamptz not null default now(),
  primary key(character_id, skill_id)
);
grant select on public.character_skills to authenticated;
grant all on public.character_skills to service_role;
alter table public.character_skills enable row level security;
create policy "own char skills" on public.character_skills for select to authenticated
  using (exists (select 1 from public.characters c where c.id=character_skills.character_id and c.user_id=auth.uid()));
create policy "admin char skills" on public.character_skills for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.knowledges(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);
grant select on public.knowledges to anon, authenticated;
grant all on public.knowledges to service_role;
alter table public.knowledges enable row level security;
create policy "knowledges public read" on public.knowledges for select to anon, authenticated using (true);
create policy "knowledges admin write" on public.knowledges for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.character_knowledges(
  character_id uuid not null references public.characters(id) on delete cascade,
  knowledge_id uuid not null references public.knowledges(id) on delete cascade,
  primary key(character_id, knowledge_id)
);
grant select on public.character_knowledges to authenticated;
grant all on public.character_knowledges to service_role;
alter table public.character_knowledges enable row level security;
create policy "own char know" on public.character_knowledges for select to authenticated
  using (exists (select 1 from public.characters c where c.id=character_knowledges.character_id and c.user_id=auth.uid()));
create policy "admin char know" on public.character_knowledges for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.outbound_messages(
  id uuid primary key default gen_random_uuid(),
  to_phone text not null, body text not null,
  status public.msg_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
grant select on public.outbound_messages to authenticated;
grant all on public.outbound_messages to service_role;
alter table public.outbound_messages enable row level security;
create policy "admin msg" on public.outbound_messages for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.bot_sessions(
  id text primary key default 'default',
  status public.bot_status not null default 'disconnected',
  qr text, phone text,
  updated_at timestamptz not null default now()
);
grant select on public.bot_sessions to authenticated;
grant all on public.bot_sessions to service_role;
alter table public.bot_sessions enable row level security;
create policy "admin bot read" on public.bot_sessions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin bot write" on public.bot_sessions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.audit_log(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  action text not null, target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin audit" on public.audit_log for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public read game images" on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars','banners','inventory'));
create policy "own upload game images" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','banners','inventory') and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own update game images" on storage.objects for update to authenticated
  using (bucket_id in ('avatars','banners','inventory') and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own delete game images" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','banners','inventory') and auth.uid()::text = (storage.foldername(name))[1]);
