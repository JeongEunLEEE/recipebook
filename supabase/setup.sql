-- 정원이의 레시피북 — Supabase 초기 설정
-- Supabase 대시보드 > SQL Editor > New query 에 전부 붙여넣고 Run 한 번이면 끝나요.
-- 여러 번 실행해도 안전하게 작성했어요.

-- 1) 멤버 명단: 여기 등록된 계정만 레시피북을 보고 쓸 수 있어요
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  legacy_id text,          -- Claude 레시피북에서 쓰던 사용자 id (평점·메모의 '나' 표시를 이어가기 위해)
  name text
);
alter table public.profiles enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid());
$$;

drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles for select to authenticated using (public.is_member());

-- 2) 문서 저장소: 레시피·위시·요리일기·외식·입맛 프로필 (col = 종류, id = 문서 id, data = 내용)
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (col, id)
);
alter table public.docs enable row level security;
drop policy if exists "members read docs" on public.docs;
drop policy if exists "members insert docs" on public.docs;
drop policy if exists "members update docs" on public.docs;
drop policy if exists "members delete docs" on public.docs;
create policy "members read docs"   on public.docs for select to authenticated using (public.is_member());
create policy "members insert docs" on public.docs for insert to authenticated with check (public.is_member());
create policy "members update docs" on public.docs for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "members delete docs" on public.docs for delete to authenticated using (public.is_member());

-- 둘이 동시에 쓸 때 상대 화면에도 바로 반영되게 (실시간)
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 3) 부분 수정 (아티팩트의 update와 같은 '깊은 합치기')
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language sql immutable as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then (
      select coalesce(jsonb_object_agg(k,
        case when a ? k and b ? k then public.jsonb_deep_merge(a -> k, b -> k)
             when b ? k then b -> k
             else a -> k end), '{}'::jsonb)
      from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) keys)
    else b end;
$$;

create or replace function public.merge_doc(p_col text, p_id text, p_patch jsonb) returns void
language plpgsql security invoker as $$
begin
  update public.docs
     set data = public.jsonb_deep_merge(data, p_patch), updated_at = now(), updated_by = auth.uid()
   where col = p_col and id = p_id;
  if not found then raise exception 'document % / % not found', p_col, p_id; end if;
end $$;

-- 4) 사진 저장소 (비공개 버킷, 멤버만)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "members read photos" on storage.objects;
drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "members update photos" on storage.objects;
create policy "members read photos"   on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "members upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_member());
create policy "members update photos" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_member());
