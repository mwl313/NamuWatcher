# Namu Watch 🔍

**나무위키 실시간 검색어 모니터링 MCP 서버**

실시간 검색어 TOP 20 확인, 키워드별 이유 설명, 과거 이력 조회, 급상승 키워드 감지까지 — 카카오톡 AI 비서를 위한 완벽한 실검 도우미 MCP 서버입니다.

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
- **보조 소스**: [나무위키](https://namu.wiki) — 아카라이브에 없는 키워드 검색 시 fallback

## 기술 스택

| 항목 | 기술 |
|:-----|:------|
| **언어** | TypeScript (Node.js 20+) |
| **런타임** | Node.js 20+ (ESM, `"type": "module"`) |
| **MCP 프로토콜** | Streamable HTTP (POST `/mcp`, 단일 JSON 응답) |
| **HTTP 파싱** | cheerio |
| **데이터베이스** | sql.js (SQLite WASM, 네이티브 빌드 불필요) |
| **입력 검증** | zod |
| **배포** | Docker (linux/amd64) |

## 시작하기

### 사전 요구사항

- Node.js 20+
- npm

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/mwl313/NamuWatcher.git
cd NamuWatcher

# 의존성 설치
npm install

# 빌드
npm run build

# 실행
node dist/index.js
```

서버가 `http://localhost:3000`에서 실행됩니다.

### Docker

```bash
# Docker 이미지 빌드
docker build --platform linux/amd64 -t namu-watch .

# 실행
docker run -p 3000:3000 -v namu-watch-data:/app/data namu-watch
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|:-------|:-----|:------|
| `POST` | `/mcp` | MCP Streamable HTTP (JSON-RPC) |
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
│   ├── index.ts           # HTTP 서버 (POST /mcp, GET /healthz, CORS)
│   ├── types.ts           # 공통 타입 정의
│   ├── utils.ts           # 유틸리티 함수
│   ├── tools/
│   │   ├── trending.ts
│   │   ├── why.ts
│   │   ├── search.ts
│   │   ├── history.ts
│   │   ├── velocity.ts
│   │   ├── related.ts
│   │   ├── trending-together.ts
│   │   └── trend-of-day.ts
│   ├── scrapers/
│   │   ├── arca.ts        # 아카라이브 스크래핑
│   │   └── namuwiki.ts    # 나무위키 스크래핑
│   └── db/
│       ├── schema.ts      # SQLite 초기화
│       └── queries.ts     # DB 쿼리 함수
├── data/                   # SQLite DB 저장소 (볼륨)
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 라이선스

MIT