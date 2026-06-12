# Magic Memo

음성·텍스트로 메모를 기록하고, 자연어 쿼리로 다시 찾아보는 PWA 친화 웹앱.

## 핵심 기능
- 텍스트 입력 + Web Speech API 한국어 음성 입력 (`ko-KR`)
- 자연어 검색: `최근 3일 이내에 마트에서 살 물건`, `어제 메모`, `지난주 회의` 등
  - 날짜 표현 파싱: 오늘 / 어제 / 그제 / 최근 N일·주·개월 / 이번·지난 주·달
  - 키워드 + 태그(`#tag`) 매칭
- `localStorage` 기반 저장 (서버·DB 없음 → **운영비 0원**)

## 비용
- **호스팅**: Vercel Hobby (무료)
- **DB**: 사용 안 함 (localStorage)
- **AI API**: 사용 안 함 (규칙 기반 한국어 파서)

추후 기능(체중·금전출납부 등)을 추가할 때도 0원 기조를 유지합니다. 동기화·다기기 지원이 필요해지면 Supabase 무료 티어 도입 여부를 먼저 문의드립니다.

## 로컬 실행
```bash
npm install
npm run dev
```
브라우저에서 http://localhost:3000

## 배포 (Vercel)
1. 이 저장소를 Vercel에 import
2. Framework: Next.js 자동 감지
3. 환경변수 불필요
4. Deploy

## 브라우저 지원
음성 입력은 Chrome / Edge / Safari에서 동작합니다. Firefox는 텍스트 입력만 사용 가능합니다.
