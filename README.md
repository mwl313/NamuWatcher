# Namu Watch 🔍

**나무위키 실시간 검색어 모니터링 MCP 서버**

실시간 검색어 TOP 20 확인, 키워드별 이유 설명, 과거 이력 조회, 급상승 키워드 감지까지 — 카카오톡 AI 비서를 위한 완벽한 실검 도우미 MCP 서버입니다.

**대회**: AGENTIC PLAYER 10 (카카오 PlayMCP)

---

## 주요 기능

| 기능 | 도구명 | 설명 |
|:-----|:-------|:------|
| 🔥 실시간 검색어 | `trending` | 현재 나무위키 실검 TOP N 조회 (카테고리 필터 가능) |
| ❓ 왜 떴는지 | `why` | 특정 키워드가 실검에 오른 이유 설명 (DB 캐시 → 아카라이브 → 나무위키 fallback) |
| 📖 문서 검색 | `search` | 나무위키 문서 요약 조회 |
| 📅 과거 이력 | `history` | 특정 날짜의 실검 순위 또는 키워드 시간별 등장 기록 |
| 📈 급상승 감지 | `velocity` | 최근 N시간 동안 조회수 급증 키워드 탐지 |
| 🔗 연관 키워드 | `related` | 특정 키워드와 함께 자주 등장하는 연관 키워드 |
| 👫 함께 트렌딩 | `trending_together` | 동시간대 함께 등장하는 키워드 쌍 분석 |
| 📊 오늘의 리포트 | `trend_of_day` | 오늘의 실검 종합 리포트 (카테고리 분포, TOP 키워드, 급상승 키워드) |

## 데이터 소스

- **주 소스**: [아카라이브 "나무위키 실검 알려주는 채널"](https://arca.live/b/namuhotnow)
  - 각 게시글 = 하나의 실검 키워드 + 사람이 작성한 이유 설명
  - 카테고리(스포츠/인방/정치/일반/TV/커뮤), 조회수, 좋아요, 댓글 수 포함
  - 게시글 링크 패턴: `<a href="/b/namuhotnow/{숫자}"...>`
- **보조 소스**: [나무위키](https://namu.wiki) — 아카라이브에 없는 키워드 검색 시 fallback
  - Vue.js SPA → HTML 소스에서 모든 텍스트 노드 수집, 첫 3문장 요약

## 기술 스택

| 항목 | 기술 |
|:-----|:------|
| **언어** | TypeScript (Node.js 20+) |
| **런타임** | Node.js 20+ (ESM, `"type": "module"`) |
| **MCP 프로토콜** | Streamable HTTP — `POST /mcp` (JSON-RPC 2.0) |
| **HTTP 서버** | Node.js 내장 `http` 모듈 |
| **HTML 파싱** | cheerio |
| **데이터베이스** | sql.js (SQLite → WASM, 네이티브 빌드 불필요) |
| **입력 검증** | zod |
| **배포** | Docker (linux/amd64) |

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- npm

### 설치 및 실행

```bash
git clone https://github.com/mwl313/NamuWatcher.git
cd NamuWatcher

npm install
npm run build
node dist/index.js
```

서버가 `http://localhost:3000`에서 실행됩니다.

### Docker

```bash
docker build --platform linux/amd64 -t namu-watch .

docker run --platform linux/amd64 -p 3000:3000 -v namu-data:/app/data namu-watch
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|:-------|:-----|:------|
| `POST` | `/mcp` | MCP Streamable HTTP (JSON-RPC 2.0) |
| `GET` | `/healthz` | 헬스체크 (상태 JSON 반환) |
| `OPTIONS` | `*` | CORS preflight |

### MCP 프로토콜

클라이언트는 표준 MCP JSON-RPC 메시지를 `POST /mcp`로 전송합니다.

**초기화:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": { "name": "my-client", "version": "1.0.0" }
  }
}
```

**도구 목록 조회:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**도구 호출:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "trending",
    "arguments": { "count": 10 }
  }
}
```

### 응답 형식

모든 도구는 아래 형식으로 응답합니다. `content[0].text` 필드 안에 JSON 문자열을 넣어 구조화된 데이터를 전달합니다.

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"type\":\"trending\",\"captured_at\":\"2026-07-07T19:00:00\",\"keywords\":[...]}"
      }
    ]
  }
}
```

에러 응답:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "\"키워드\"에 대한 정보를 찾을 수 없습니다."
  }
}
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|:-----|:-------|:------|
| `PORT` | `3000` | HTTP 서버 포트 |
| `DB_PATH` | `/app/data/namu_watch.db` | SQLite 파일 경로 |
| `NODE_ENV` | `production` | 실행 모드 |

## 프로젝트 구조

```
namu-watch/
├── src/
│   ├── index.ts           # HTTP 서버 (POST /mcp, GET /healthz, CORS, JSON-RPC 핸들러)
│   ├── types.ts           # 공통 타입 정의 (응답/DB/스크래퍼)
│   ├── utils.ts           # 유틸리티 함수 (delay, fetch, 카테고리 분류, 텍스트 정제)
│   ├── tools/
│   │   ├── trending.ts          # 현재 실검 TOP N + DB 자동 저장
│   │   ├── why.ts               # 키워드 이유 (DB → 아카라이브 → 나무위키 fallback)
│   │   ├── search.ts            # 나무위키 문서 검색
│   │   ├── history.ts           # 과거 실검 (날짜별/키워드별)
│   │   ├── velocity.ts          # 급상승 키워드 (증가율 계산)
│   │   ├── related.ts           # 연관 키워드 (동시등장횟수)
│   │   ├── trending-together.ts # 함께 뜨는 키워드 쌍
│   │   └── trend-of-day.ts      # 오늘 종합 리포트
│   ├── scrapers/
│   │   ├── arca.ts        # 아카라이브 목록/상세 스크래핑 (per-element 숫자 추출)
│   │   └── namuwiki.ts    # 나무위키 문서 fallback 파싱
│   └── db/
│       ├── schema.ts      # sql.js 초기화 + snapshots/articles 테이블 DDL
│       └── queries.ts     # DB CRUD 함수 (12개)
├── data/                   # SQLite DB 저장소 (볼륨 마운트)
├── Dockerfile              # Multi-stage, node:20-alpine, linux/amd64
├── package.json
├── tsconfig.json
└── README.md
```

## 데이터베이스

### snapshots 테이블
스크래핑할 때마다 저장되는 실검 순위 스냅샷.

| 컬럼 | 타입 | 설명 |
|:-----|:-----|:------|
| id | INTEGER PK | AUTOINCREMENT |
| captured_at | TEXT | 스크래핑 시각 |
| rank | INTEGER | 순위 |
| keyword | TEXT | 키워드명 |
| category | TEXT | 카테고리 (스포츠/인방/정치/일반/TV/커뮤/기타) |
| views | INTEGER | 조회수 |
| likes | INTEGER | 좋아요 수 |
| comments | INTEGER | 댓글 수 |
| post_id | INTEGER | 아카라이브 게시글 ID |

### articles 테이블
아카라이브 게시글 본문 캐시.

| 컬럼 | 타입 | 설명 |
|:-----|:-----|:------|
| post_id | INTEGER PK | 아카라이브 게시글 ID |
| keyword | TEXT | 키워드명 |
| category | TEXT | 카테고리 |
| body | TEXT | 게시글 본문 (실검 이유) |
| views/likes/comments | INTEGER | 통계 |
| posted_at | TEXT | 아카라이브 작성일시 |
| fetched_at | TEXT | 캐시 시각 |

## 배포 체크리스트

### 로컬 검증
- [x] `npm run build` 에러 없음
- [x] 로컬 서버 기동 확인
- [x] `GET /healthz` → `{"status":"ok"}`
- [x] `tools/list`에 8개 도구 정상 표시
- [x] Docker build 성공

### PlayMCP in KC 등록
- [ ] https://playmcp.kakaocloud.io 접속
- [ ] Git 소스 빌드로 서버 생성
- [ ] Status: **Active** 확인
- [ ] Endpoint URL 복사

### PlayMCP 등록
- [ ] https://playmcp.kakao.com → 개발자 콘솔
- [ ] 새 MCP 서버 등록 → Endpoint URL 입력
- [ ] **정보 불러오기** 성공 확인
- [ ] **임시 등록** (심사 요청 금지)
- [ ] 도구함에 추가 → AI 채팅으로 8개 도구 테스트
- [ ] 심사 요청 → 승인 메일 확인
- [ ] 공개 상태 → **전체 공개** 전환

## 라이선스

MIT