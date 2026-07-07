# Namu Watch — Cline 실행 프롬프트

> **설계 문서**: `documents/DESIGN.md` — **Cline이 반드시 먼저 읽고 따라야 함**
> **기술**: Node.js 20 + TypeScript + MCP SDK (Streamable HTTP)
> **모델**: DeepSeek Flash (`deepseek-chat`)
> **타임아웃**: Phase 1 = 600s, Phase 2 = 600s

---

## Phase 1: 프로젝트 전체 생성 (8개 도구 + DB + Docker)

```bash
npx cline --cwd . --auto-approve true -P deepseek -m deepseek-chat --timeout 600
```

**프롬프트:**

```
C:\Users\임민우\Desktop\Namu Watcher MCP\documents\DESIGN.md 파일을 먼저 읽어줘.
이 문서가 이 프로젝트의 유일한 설계 명세야.

설계 문서를 기반으로 Namu Watch MCP 서버를 처음부터 끝까지 구현해줘.

### 필수 조건
- Node.js 20 + TypeScript (ESM, type: "module")
- Streamable HTTP (POST /mcp, GET /healthz, CORS)
- Docker 배포 (linux/amd64, node:20-alpine)
- 패키지: @modelcontextprotocol/sdk, cheerio, better-sqlite3, zod, zod-to-json-schema

### 구현할 전체 파일 목록

1. package.json, tsconfig.json, .gitignore, .dockerignore
2. src/types.ts
3. src/utils.ts
4. src/db/schema.ts
5. src/db/queries.ts
6. src/scrapers/arca.ts
7. src/scrapers/namuwiki.ts
8. src/tools/trending.ts
9. src/tools/why.ts
10. src/tools/search.ts
11. src/tools/history.ts
12. src/tools/velocity.ts
13. src/tools/related.ts
14. src/tools/trending-together.ts
15. src/tools/trend-of-day.ts
16. src/mcp-server.ts
17. src/index.ts
18. Dockerfile

### 중요: 반드시 DESIGN.md 대로

- 각 도구의 **동작 방식**과 **파라미터**는 DESIGN.md 3장을 그대로 따라
- 각 도구의 **description**은 DESIGN.md 4장의 문장을 **정확히 그대로 복사** (AI 자연어 매핑의 유일한 단서)
- 각 도구의 **응답 JSON 구조**는 DESIGN.md 8.3항의 필드 명세를 따라
- **DB 테이블 구조**는 DESIGN.md 6장을 따라
- **스크래핑 규칙**은 DESIGN.md 2장의 카테고리 추출 규칙, HTML 구조 패턴, Rate limit을 따라
- **why 도구의 fallback 순서**: DB 캐시 → 아카라이브 → 나무위키 (DESIGN.md 3.2항)
- **velocity 증가율 계산식**: ((현재평균 - 이전평균) / 이전평균) × 100 (DESIGN.md 3.5항)
- **Docker 요구사항**: DESIGN.md 9장 및 11.4항을 따라
- **에러 응답 형식**: DESIGN.md 8.3항의 에러 응답 형식을 따라

### 제약 조건
- 모든 import는 .js 확장자 (ESM)
- CORS 헤더 필수
- 아카라이브 상세 요청은 500ms delay, 나무위키는 300ms delay
- 응답 text 필드는 항상 JSON.stringify한 문자열
- 한 파일씩 순서대로 생성
```

---

## Phase 2: (없음 — Phase 1에서 모든 도구를 한 번에 생성)

Phase 1 프롬프트에서 **trending부터 trend-of-day까지 8개 도구 전부**를 한 번에 생성하므로,
별도의 Phase 2가 필요 없음. Phase 1 완료 후 바로 `npm run build`로 검증.

---

## 로컬 테스트

```bash
cd C:\Users\임민우\Desktop\Namu Watcher MCP

# 빌드
npm run build

# 개발 서버 실행
npm run dev

# 다른 터미널에서 테스트
# 헬스체크
curl http://localhost:3000/healthz

# MCP 초기화
curl -X POST http://localhost:3000/mcp ^
  -H "Content-Type: application/json" ^
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1\"}}}"

# 도구 목록 조회
curl -X POST http://localhost:3000/mcp ^
  -H "Content-Type: application/json" ^
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}"
```

---

## Docker 빌드 및 테스트

```bash
# 빌드 (linux/amd64 필수!)
docker build --platform linux/amd64 -t namu-watch .

# 실행
docker run --platform linux/amd64 -p 3000:3000 -v namu-data:/app/data namu-watch

# 헬스체크
curl http://localhost:3000/healthz
```

---

## 배포 체크리스트

### 코드 완성 확인
- [ ] `npm run build` 에러 없음
- [ ] 로컬 서버 기동 확인
- [ ] `curl /healthz` → `{"status":"ok"}`
- [ ] `tools/list`에 8개 도구 정상 표시
- [ ] Docker build 성공
- [ ] GitHub에 push

### PlayMCP in KC 등록
- [ ] https://playmcp.kakaocloud.io 접속
- [ ] Git 소스 빌드로 서버 생성
- [ ] Status: **Active** 확인
- [ ] Endpoint URL 복사

### PlayMCP 등록
- [ ] https://playmcp.kakao.com → 개발자 콘솔
- [ ] 새 MCP 서버 등록 → Endpoint URL 입력
- [ ] **정보 불러오기** 성공 확인
- [ ] **임시 등록** (심사 요청 금지!)
- [ ] 도구함에 추가 → AI 채팅 테스트
- [ ] 8개 도구 모두 정상 동작 확인

### 심사 및 접수
- [ ] **심사 요청** 클릭
- [ ] 승인 메일 확인
- [ ] 공개 상태 → **전체 공개** 전환
- [ ] https://b.kakao.com/views/PlayMCP/AGENTIC_PlAYER_10
- [ ] **Player 예선 참여** 버튼 → 비즈폼 접수
