# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

음성·텍스트로 메모를 기록하고 한국어 자연어 쿼리로 다시 찾는 단일 페이지 웹앱. 사용자는 추후 체중 기록·금전출납부 등 모듈을 같은 앱에 점진 추가할 계획이며, **운영비 0원**이 절대 제약이다. 유료 자원(외부 DB, AI API, 유료 호스팅 등) 도입은 반드시 사전 문의.

배포: https://magicmemo2.vercel.app (Vercel Hobby, GitHub `kiuza1004/magic_memo2` `main` 푸시 시 자동 재배포)

## Commands

```bash
npm install         # 의존성 설치
npm run dev         # 로컬 개발 서버 (http://localhost:3000)
npm run build       # 프로덕션 빌드 + 타입 체크
npm run start       # 빌드 산출물 실행
npx vercel --prod --yes   # 프로덕션 배포 (이미 link 되어 있음)
```

테스트 프레임워크는 도입돼 있지 않다. 변경 후 `npm run build`로 TypeScript strict 체크를 통과시키는 것이 1차 검증이다.

## Architecture

### 데이터 흐름
- **저장소**: 브라우저 `localStorage` 키 `magic_memo_v1` (서버 없음, 0원 원칙)
- **상태**: `app/page.tsx`의 `useState`로 메모리 보관. 마운트 시 `loadMemos()`로 복원, 변경마다 `saveMemos()` 호출
- **타입 단일 소스**: `lib/types.ts`의 `Memo`, `SearchResult`

### 핵심 모듈
- `lib/storage.ts` — localStorage CRUD. `#태그`는 `extractTags`로 본문에서 자동 추출
- `lib/search.ts` — **한국어 규칙 기반 검색** (LLM 미사용)
  - `parseDateRange(query)` — `오늘/어제/그제/최근 N일·주·개월/이번·지난 주·달` 파싱. 한국어 수사(한·두·세 / 일·이·삼)도 지원
  - `extractKeywords(query)` — 불용어(조사·동사 어미) 제거 후 토큰화
  - `search(query, memos)` — 날짜 범위로 필터 → 키워드 매칭 점수(본문 +2, 태그 +1)로 정렬
- `lib/speech.ts` — Web Speech API 래퍼. **모바일 Chrome의 누적 final emit 버그를 회피**하는 게 핵심:
  - 각 `onresult` 이벤트에서 `e.results`를 인덱스 0부터 **전체 재구성**하여 `sessionFinal`을 교체 (append 아님)
  - 세션 종료(`onend`) 시점에만 `baseline`에 누적
  - `onend` 시 사용자가 정지하지 않았으면 자동 재시작 (Android에서 `continuous=true`가 무시되는 환경 대응)

### UI
- 단일 페이지 (`app/page.tsx`). 새 메모 입력 / 검색 / 메모 리스트 3섹션
- Tailwind는 `bg`(배경) `card`(카드) `accent`(액션 컬러) 세 가지 커스텀 토큰만 사용 — 새 컴포넌트 추가 시 이 토큰 우선 사용
- Web Speech API는 Chrome/Edge/Safari만 동작 → `isSpeechSupported()` 체크 후 조건부 렌더링

## 작업 규칙 (사용자 합의 사항)

- **비용 0원 원칙**: 유료 자원 도입은 무조건 사전 문의. 자연어 검색은 규칙 기반 파서로 먼저 시도하고, 정확도 부족 시에만 API 옵션을 제안 (Hobby 무료 한도 안에서만)
- **음성 인식 수정 시 주의**: `lib/speech.ts`는 모바일 Chrome의 누적 emit 동작을 가정한다. "각 이벤트마다 전체 재구성, 세션 끝에만 누적" 패턴을 깨지 말 것. 변경 시 모바일 실기기에서 같은 단어 반복 발화로 검증
- **모듈 확장 시**: 새 도메인(체중, 금전출납부 등)은 localStorage 키를 분리(`magic_memo_weight_v1` 식). 같은 검색 파서를 재사용할 수 있도록 데이터 모델에 `text: string` + `createdAt: number`를 최소 공통으로 유지
- **GitHub 푸시 = 배포**: `main`이 곧 프로덕션. 실험은 브랜치에서 진행 후 확인되면 머지
