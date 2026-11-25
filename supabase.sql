-- FORGE Fitness AV2: script incremental e seguro (preserva tabelas e registros existentes).
-- Execute no SQL Editor do Supabase.

-- 1. Tabela de perfis vinculada ao Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 2. Função auxiliar para verificar se o usuário autenticado é administrador
create or replace function public.is_forge_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

revoke all on function public.is_forge_admin() from public;
grant execute on function public.is_forge_admin() to authenticated;

-- 3. Política de leitura do próprio perfil
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- 4. Gatilho para criar perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_forge_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_forge_auth_user_created on auth.users;
create trigger on_forge_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_forge_user();

-- 5. Garantir RLS ativo e políticas de escrita exclusiva para administradores nas 4 tabelas existentes
alter table public.trainings enable row level security;
alter table public.coaches enable row level security;
alter table public.schedules enable row level security;
alter table public.locations enable row level security;

drop policy if exists "Admins manage trainings" on public.trainings;
create policy "Admins manage trainings"
  on public.trainings
  for all
  to authenticated
  using (public.is_forge_admin())
  with check (public.is_forge_admin());

drop policy if exists "Admins manage coaches" on public.coaches;
create policy "Admins manage coaches"
  on public.coaches
  for all
  to authenticated
  using (public.is_forge_admin())
  with check (public.is_forge_admin());

drop policy if exists "Admins manage schedules" on public.schedules;
create policy "Admins manage schedules"
  on public.schedules
  for all
  to authenticated
  using (public.is_forge_admin())
  with check (public.is_forge_admin());

drop policy if exists "Admins manage locations" on public.locations;
create policy "Admins manage locations"
  on public.locations
  for all
  to authenticated
  using (public.is_forge_admin())
  with check (public.is_forge_admin());
