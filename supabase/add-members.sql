-- 멤버 등록: Authentication > Users 에서 두 사람 계정을 만든 다음 실행하세요.
-- 이메일 두 곳만 실제 주소로 바꾸고 Run.

-- 정원 (Claude 레시피북에서 쓰던 id를 이어받아서, 기존 평점·메모가 '나'로 보여요)
insert into public.profiles (user_id, legacy_id, name)
select id, 'u_LgelKOpKeF1aBR2EGM9fhw', '정원' from auth.users where email = '정원이메일@example.com'
on conflict (user_id) do update set legacy_id = excluded.legacy_id, name = excluded.name;

-- 원민
insert into public.profiles (user_id, legacy_id, name)
select id, null, '원민' from auth.users where email = '원민이메일@example.com'
on conflict (user_id) do update set name = excluded.name;

-- 확인: 두 줄이 나오면 성공
select p.name, u.email from public.profiles p join auth.users u on u.id = p.user_id;
