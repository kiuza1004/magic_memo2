# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

음성·텍스트로 메모를 기록하고 한국어 자연어 쿼리로 다시 찾는 단일 페이지 웹앱. 사용자는 추후 체중 기록·금전출납부 등 모듈을 같은 앱에 점진 추가할 계획이며, **운영비 0원**이 절대 제약이다. 유료 자원(외부 DB, AI API, 유료 호스팅 등) 도입은 반드시 사전 문의.

## Deployment topology

같은 GitHub 저장소(`kiuza1004/magic_memo2`)가 **두 개의 Vercel 프로젝트**에 연결돼 있고 `main` 푸시 시 양쪽 모두 자동 배포된다:

| Vercel 프로젝트 | 공개 URL | 배포 경로 |
|---|---|---|
| `magic-memo2` (대시) | https://magic-memo2.vercel.app | GitHub 자동 |
| `magic_memo2` (언더스코어) | https://magicmemo2.vercel.app | GitHub 자동 + 로컬 `.vercel/`가 이쪽에 link 됨 → `npx vercel --prod`도 여기로 감 |

사용자는 주로 **대시 버전**(`magic-memo2.vercel.app`)을 본다. 배포 후 검증할 때 URL 변형을 정확히 맞춰 확인할 것.

## Commands

```bash
npm install               # 의존성 설치
npm run dev               # 로컬 개발 서버 (http://localhost:3000)
npm run build             # 프로덕션 빌드 + 타입 체크 (테스트 프레임워크 없음 → 1차 검증)
npx vercel --prod --yes   # magic_memo2 프로젝트로 수동 배포 (GitHub 푸시로도 동일 효과)
```

### 배포 후 검증 (필수)

1. 양쪽 URL의 번들 해시 확인 — 같은 해시여야 동일 코드:
   ```bash
   curl -s https://magic-memo2.vercel.app | grep -oE 'page-[a-f0-9]+\.js' | head -1
   curl -s https://magicmemo2.vercel.app | grep -oE 'page-[a-f0-9]+\.js' | head -1
   ```
2. 번들 내용에 신규 변경의 고유 심볼이 들어갔는지 grep:
   ```bash
   curl -s "https://magic-memo2.vercel.app/_next/static/chunks/app/<hash>.js" | grep -c "<신규 함수명>"
   ```
3. HTTP 200만 보지 말 것. 직접 번들 내용을 확인하지 않으면 잘못된 프로젝트로 배포해놓고 "고쳤다"고 잘못 보고하기 쉽다.

## Architecture

### 데이터 흐름
- **저장소**: 브라우저 `localStorage` 키 `magic_memo_v1` (서버 없음, 0원 원칙)
- **상태**: `app/page.tsx`의 `useState`로 메모리 보관. 마운트 시 `loadMemos()`로 복원, 변경마다 `saveMemos()` 호출
- **타입 단일 소스**: `lib/types.ts`의 `Memo`, `SearchResult`

### 핵심 모듈
- `lib/storage.ts` — localStorage CRUD. `#태그`는 `extractTags`로 본문에서 자동 추출
- `lib/search.ts` — **한국어 규칙 기반 검색** (LLM 미사용)
  - `parseDateRange(query)` — `오늘/어제/그제/최근 N일·주·개월/이번·지난 주·달`. 한국어 수사(한·두·세 / 일·이·삼)도 지원
  - `extractKeywords(query)` — 불용어(조사·동사 어미) 제거 후 토큰화
  - `search(query, memos)` — 날짜 범위로 필터 → 키워드 매칭 점수(본문 +2, 태그 +1)로 정렬
- `lib/speech.ts` — **`Stt` 클래스** (translator_app2 `D:\AI CLAUDE\random\translator_app2\web\js\speech.js`의 검증된 패턴을 그대로 포팅). 핵심:
  - `continuous = false` — 한 utterance = 한 세션 = `onResult` 1회 호출
  - `onResult(text)`: 완성된 final 1회 emit. 호출자가 이걸로만 draft에 append
  - `onPartial(text)`: interim 미리보기 (UI 표시용, 절대 누적 금지)
  - `onend` → 사용자 stop 아니면 새 recognizer spawn. 직전 인스턴스는 핸들러 null → `abort()`로 stale 콜백 차단
  - **이 패턴 외 다른 방식(continuous=true + 누적 / startsWith 디둡 등)은 모바일 Chrome에서 모두 실패함이 확인됨. 변경하지 말 것.**

### UI
- 단일 페이지 (`app/page.tsx`). 새 메모 입력 / 검색 / 메모 리스트 3섹션
- 메모 입력: [저장] [지우기] [🎙 음성] 3버튼. interim은 입력칸 아래 회색 이탤릭으로 임시 표시
- 검색: 단일 입력 + 🎙. interim은 placeholder에 표시
- Tailwind 커스텀 토큰: `bg`(배경) `card`(카드) `accent`(액션 컬러) — 새 컴포넌트 추가 시 우선 사용
- Web Speech API는 Chrome/Edge/Safari만 동작 → `isSpeechSupported()` 체크 후 조건부 렌더링

## 작업 규칙 (사용자 합의 사항)

- **비용 0원 원칙**: 유료 자원 도입은 무조건 사전 문의. 자연어 검색은 규칙 기반 파서로 먼저 시도하고, 정확도 부족 시에만 API 옵션을 제안
- **음성 인식**: `lib/speech.ts`의 `Stt` 클래스 구조(continuous=false + onResult/onPartial 분리 + onend spawn)를 유지. 모바일 실기기에서 같은 단어 반복 발화로 검증한 코드임. 다른 패턴으로 "개선"하지 말 것
- **모듈 확장 시**: 새 도메인(체중, 금전출납부 등)은 localStorage 키를 분리(`magic_memo_weight_v1` 식). 검색 파서를 재사용할 수 있도록 데이터 모델에 `text: string` + `createdAt: number`를 최소 공통으로 유지
- **GitHub 푸시 = 양쪽 자동 배포**: `main`이 곧 프로덕션. 실험은 브랜치에서 진행 후 확인되면 머지
- **사용자가 "안 바뀌었다"고 말하면**: 새로 짜기 전에 먼저 (1) 사용자가 보는 URL 호스트명을 글자 단위로 확인 (2) 번들 해시·심볼 grep으로 실제 배포 여부 확인 (3) 모바일 캐시/하드 새로고침 안내. 코드를 또 고치는 건 위 3가지를 확인한 뒤에
