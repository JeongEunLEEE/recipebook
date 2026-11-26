# 정원이의 레시피북 (웹사이트 버전)

Claude 아티팩트로 만든 레시피북을 독립 웹사이트로 옮긴 버전이에요. 화면과 기능(레시피·해볼 것·확인 필요·요리일기·외식·기념·우리 취향, 사진 업로드·썸네일 위치·회전, 둘이 동시에 쓰기)은 그대로예요. AI 기능(사진으로 초안, 유튜브 본문 정리, 메뉴 추천)만 꺼져 있어요.

- 화면: GitHub Pages (무료)
- 로그인·데이터·사진: Supabase (무료 플랜)
- 코드는 공개돼도 괜찮아요. 레시피·사진은 Supabase에 있고, 등록된 두 사람만 볼 수 있어요.

## 처음 한 번만 하는 설정 (약 20분)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 GitHub 계정으로 가입
2. **New project** → 이름 `recipebook`, 비밀번호는 아무거나 길게(따로 쓸 일 없음), Region은 **Northeast Asia (Seoul)** → Create

### 2. 데이터베이스 설정
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 `supabase/setup.sql` 내용을 전부 붙여넣고 **Run** → "Success" 확인

### 3. 웹사이트에 Supabase 연결
1. Supabase 왼쪽 아래 **Project Settings → API** (또는 Data API)
2. **Project URL**과 **anon public** 키를 복사
3. GitHub 저장소에서 `config.js` 열기 → 연필(✏️) 아이콘 → 두 값을 붙여넣고 **Commit changes**
   - `service_role` 키는 절대 넣지 마세요.

### 4. 두 사람 계정 만들기
1. Supabase **Authentication → Users → Add user → Create new user**
   - 정원, 원민 각각 이메일·비밀번호 입력, **Auto Confirm User** 체크
2. **Authentication → Sign In / Providers → Email**에서 **Allow new users to sign up**을 끄기 (다른 사람이 가입 못 하게)
3. **SQL Editor**에서 `supabase/add-members.sql`을 붙여넣고, 이메일 두 곳을 실제 주소로 바꾼 뒤 **Run** → 마지막에 두 줄이 나오면 성공

### 5. 웹사이트 열기 (GitHub Pages)
1. GitHub 저장소 **Settings → Pages**
2. Source: **Deploy from a branch**, Branch: **main** / **(root)** → Save
3. 1~2분 뒤 위쪽에 주소가 떠요: `https://<GitHub아이디>.github.io/recipebook/`
4. 열어서 4단계에서 만든 이메일·비밀번호로 로그인

### 6. Claude 레시피북 데이터 옮기기
1. 컴퓨터에서 Claude 레시피북을 열고 왼쪽 프로필 아래 **💾 백업 내보내기** → zip 저장 (사진까지 담겨서 수십 MB예요)
2. 웹사이트 주소 뒤에 `import.html`을 붙여 열기 (예: `https://<아이디>.github.io/recipebook/import.html`)
3. zip 파일 선택 → **가져오기** → "완료!"가 뜨면 레시피북으로 돌아가기

### 7. 휴대폰에서 앱처럼
- 아이폰 Safari: 웹사이트 열기 → 공유 → **홈 화면에 추가**
- 안드로이드 Chrome: ⋮ → **홈 화면에 추가**
- 웹사이트는 Claude 로그인이 필요 없어요. 레시피북 계정으로 한 번 로그인하면 계속 유지돼요.

## Claude 레시피북과의 관계

두 곳은 **따로 저장돼요.** 한쪽에서 고친 내용이 다른 쪽에 자동으로 넘어가지 않아요.

- **Claude → 웹사이트:** 언제든 6단계(백업 내보내기 → 가져오기)를 다시 하면 돼요. 같은 기록은 Claude 쪽 내용으로 덮어쓰고, 웹사이트에서만 만든 기록은 남아요.
- **웹사이트 → Claude:** 아직 없어요.
- 월요일 자동 업데이트(드라이브 사진, 유튜브 링크 정리)는 지금 **Claude 레시피북에만** 들어가요.

추천: 비교해 보는 동안은 **Claude 레시피북을 주로 쓰고**, 가끔 가져오기로 웹사이트를 맞춰 두세요. 웹사이트를 주로 쓰기로 정하면 그때 자동 업데이트도 웹사이트로 옮기면 돼요.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 레시피북 화면 (Claude 버전과 같은 코드) |
| `supa-shim.js` | 저장·사진·로그인을 Supabase로 연결하는 층 |
| `config.js` | Supabase 주소와 anon 키 |
| `import.html` | Claude 백업 zip 가져오기 |
| `supabase/setup.sql` | 테이블·보안 규칙·사진 저장소 만들기 |
| `supabase/add-members.sql` | 두 사람을 멤버로 등록 |

## 무료 한도 (참고)
Supabase 무료 플랜은 DB·사진 저장 용량과 월 전송량에 한도가 있어요. 지금 데이터(사진 수백 장)는 여유 있게 들어가요. 정확한 한도는 Supabase 요금 페이지에서 확인하세요. 무료 프로젝트는 오래 접속이 없으면 일시정지될 수 있는데, 대시보드에서 다시 켜면 돼요.
