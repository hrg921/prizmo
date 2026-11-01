# 프리즈모 PRIZMO — Working Prototype

대장암 진단 직후의 환자·보호자가 **공개 기록으로 집도의를 비교**하는 앱.
평가하지 않고 공개 기록만 보여 주며, 정렬은 환자가 고른 기준을 따릅니다. 광고는 정렬에 반영하지 않습니다.

- **Next.js 16** (App Router, Server Actions)
- **Postgres**
  - 배포(Vercel): Neon — `DATABASE_URL`로 접속 (postgres.js)
  - 로컬 개발: 설치 없이 PGlite(WASM 임베디드 Postgres, `./data/pglite`)
- 첫 요청 때 스키마 생성 + 예시 데이터 시드 (advisory lock으로 동시 콜드 스타트에도 한 번만)
- 예시 데이터는 `SEED_VERSION`(`src/lib/seed.ts`)으로 관리 — 값을 올려 배포하면 **새 행만 추가**되고
  기존 의료진·사용자·열람 기록은 그대로 둡니다. 기존 의료진(id)의 값을 바꾸려면 DB에서 직접 수정하세요.

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:3000  (DB 설치 불필요)
```

- 로컬 DB 초기화: 서버를 끄고 `rm -rf data`
- 로컬에서 실제 Postgres를 쓰려면 `.env.local`에 `DATABASE_URL=...` 를 넣으세요.
  Vercel에 연결한 뒤라면 `npx vercel env pull .env.local` 로 Neon 접속 정보를 그대로 받아올 수 있어요.

## Vercel 배포

1. **GitHub에 올리기** — 이 폴더를 새 저장소로 push
2. **Vercel에서 Import** — [vercel.com/new](https://vercel.com/new) → 저장소 선택 → Framework는 자동으로 Next.js
3. **DB 연결** — 프로젝트의 **Storage** 탭 → **Neon** (Postgres) 생성 → 프로젝트에 연결
   → `DATABASE_URL` 환경변수가 자동으로 들어갑니다. 지역은 사용자와 가까운 아시아 리전을 고르세요.
4. **환경변수 추가** — Settings → Environment Variables
   - `SESSION_SECRET` : 32자 이상 랜덤 문자열 (`openssl rand -hex 32`)
   - `ADMIN_TOKEN` : `/admin?token=...` 에 쓸 토큰
5. **함수 리전 맞추기** — Settings → Functions → Region 을 **Neon DB와 같은(가장 가까운) 리전**으로.
   한 화면에서 쿼리를 여러 번 하므로 함수와 DB가 멀면 체감 속도가 크게 느려집니다.
6. **Redeploy** — 환경변수를 넣은 뒤 한 번 다시 배포. 첫 요청 때 테이블과 예시 데이터가 자동으로 만들어집니다.

> `DATABASE_URL` 없이 Vercel에 배포되면 DB를 쓰는 화면에서
> "DATABASE_URL이 없습니다…" 오류가, `SESSION_SECRET`이 없으면 가입 시 오류가 납니다. (조용히 잘못 동작하지 않도록 일부러 막아 둠)

## 데모 플로우 (9단계)

| # | 화면 | 경로 | 구현 포인트 |
|---|---|---|---|
| 01 | 가입과 본인인증 | `/signup` | 휴대폰 인증번호(데모: 화면에 표시, 3분 유효), 필수/선택 약관, **민감정보 별도 동의** |
| 02 | 가입 완료 | `/welcome` | 무료 열람권 2회 지급 (`users.view_credits`) |
| 03 | 상황 입력 | `/situation` | 부위·병기·고민·지역 + **기준 정확히 2개** (선택 순서 = 정렬 우선순위) |
| 04 | 기준 정렬 목록 | `/results` | 지역·부위로 거른 뒤 **고른 기준 순서대로 `ORDER BY` 다중 키** — 점수·가중치 없음. 스폰서 영역은 목록과 분리 |
| 05 | 의료진 리포트 | `/doctors/[id]` | 연구·자격·임상시험·병원·조건 5축 공개 기록. 1순위 기준 축 강조 |
| 06 | 연구 공개 기록 | `/doctors/[id]/research` | 최근 5년 논문, 내 고민 태그로 필터(`= ANY(tags)`), 원문 보기 |
| 07 | 두 번째 열람 | `/results` → 열람 | 열람권 차감은 트랜잭션 + `SELECT … FOR UPDATE` — 연타해도 한 번만 차감 |
| 08 | 비교와 진료 준비 | `/compare` | 열람한 의료진 나란히 비교 + 상황 기반 **첫 진료 질문**, 가족 공유(Web Share/복사)·PDF 저장(인쇄) |
| 09 | 열람권 소진 | `/results`, `/purchase` | 0회면 `열람권 구매` → 구매 안내(데모 결제) → 바로 열람 |

그 외: `/settings`(민감정보 동의 철회 시 상황 정보 즉시 삭제, 마케팅 수신, 로그아웃, 탈퇴 — FK `ON DELETE CASCADE`),
각 축 상세 `/doctors/[id]/records/[axis]`, `/admin` — 9단계 퍼널·기준 선호/조합·지역×부위·피드백 집계
(개발 모드는 바로 열림, 운영은 `?token=$ADMIN_TOKEN`).

## 구조

```
src/
  app/
    actions.ts            # Server Actions: 본인인증, 가입, 상황 저장, 열람(트랜잭션), 구매, 설정, 피드백
    signup/ welcome/ situation/ results/ doctors/[id]/… compare/ purchase/ settings/ admin/
  lib/
    db.ts                 # postgres.js(DATABASE_URL) ↔ PGlite(로컬) 드라이버, 지연 초기화, tx
    seed.ts               # 스키마 + 예시 데이터 (가명 의료진 22명, 논문 389건, 임상 31건 …)
    queries.ts            # 정렬 쿼리, 리포트/기록/질문 조회, 이벤트 로그
    session.ts            # HMAC 서명 쿠키 세션
    constants.ts          # 클라이언트·서버 공용 상수
  components/ui.tsx       # Header, Logo, Chevron 등
```

### 정렬 방식 (점수 없음)

```ts
// lib/queries.ts
"연구 경력": "research_n DESC"
"자격·경력": "(cert_short = '세부전문의') DESC, career_years DESC"
"임상시험":  "trials_n DESC"
"병원 평가": "hospital_grade ASC, multidisciplinary DESC"
"조건":      "distance_km ASC"   // 진료 조건 — 가까운 병원부터
```
고른 두 기준의 키를 순서대로 이어 붙이고 마지막에 `d.id`로 안정 정렬합니다. 합산 점수나 순위 표시는 만들지 않습니다.

## 환경 변수 (`.env.example`)

| 이름 | 로컬 | Vercel |
|---|---|---|
| `DATABASE_URL` | 선택 (없으면 PGlite) | **필수** (Neon 연결 시 자동) |
| `SESSION_SECRET` | 선택 | **필수** |
| `ADMIN_TOKEN` | 선택 | `/admin` 쓰려면 필수 |

## 참고

- 의료진·논문·임상시험 데이터는 모두 **가명 예시 데이터**입니다. "원문 보기"는 영문 제목으로 PubMed 검색을 엽니다.
- 본인인증은 SMS 대신 화면에 인증번호를 보여 주는 데모 구현입니다(PASS 등 본인확인기관 연동 자리).
- 결제는 데모입니다. 가격은 예시입니다.
- 실제 사용자를 받으면 건강 정보(민감정보)가 저장됩니다. 개인정보 처리방침 고지와 DB 리전 선택을 함께 챙기세요.
- Next.js 16 기본값인 Cache Components는 꺼 두었습니다(`next.config.ts`). 모든 화면이 로그인 세션과 DB 상태에 따라 달라지는 프로토타입이라 요청 시 렌더링 모델이 단순합니다.
