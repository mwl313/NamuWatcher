# Namu Watch 🔍

**AI로 나무위키를 읽다**

Namu Watch는 AI 챗봇이 사용자의 자연어 요청에 따라 나무위키 문서를 검색하고 읽을 수 있게 해주는 MCP 서버입니다.

"**나무위키에서 이순신 알려줘**" — 이 한마디로 AI가 나무위키 문서를 찾아 요약해줍니다. 실시간 검색어 트렌드와 각 키워드가 왜 뜨는지도 함께 확인할 수 있습니다.

---

## 주요 기능

| 기능 | 도구명 | 설명 |
|:-----|:-------|:------|
| 🔍 **나무위키 검색** | `search` | 나무위키 문서 검색 및 첫 문단 요약. **핵심 기능** |
| 🔥 **실시간 검색어** | `trending` | 현재 나무위키 실검 TOP N 조회 |
| ❓ **왜 떴는지** | `why` | 특정 키워드가 실검에 오른 이유 설명 |
| 📅 **과거 이력** | `history` | 특정 날짜의 실검 순위 또는 키워드 시간별 등장 기록 |
| 📈 **급상승 감지** | `velocity` | 최근 N시간 동안 조회수 급증 키워드 탐지 |
| 🔗 **연관 키워드** | `related` | 특정 키워드와 함께 자주 등장하는 연관 키워드 |
| 👫 **함께 트렌딩** | `trending_together` | 동시간대 함께 등장하는 키워드 쌍 분석 |
| 📊 **오늘의 리포트** | `trend_of_day` | 오늘의 실검 종합 리포트 |

## 사용 예시

사용자는 카카오톡 채팅에서 자연어로 질문하면 됩니다. 모든 명령어는 AI가 자동으로 인식합니다.

```
👤 "나무위키에서 이순신에 대해 알려줘"
→ AI가 search("이순신") 호출
🤖 "이순신은 조선 중기의 무신으로..."

👤 "ㄱㄱㅅ이 누구야?"
→ AI가 search("ㄱㄱㅅ") 호출, 적절한 문서 탐색
🤖 "고구마순이라고도 불리는..."

👤 "지금 실검 뭐 뜨고 있어?"
→ AI가 trending() 호출
🤖 "🔥 실시간 검색어 TOP 10..."

👤 "호날두 왜 실검에 떴어?"
→ AI가 why("호날두") 호출
🤖 "오늘 스페인과의 16강전에 선발 출전했으나 1-0으로..."
```

## 데이터 소스

- **주 소스**: [나무위키](https://namu.wiki) — AI가 사용자의 질문에 답하기 위해 문서를 검색하고 요약합니다.
- **보조 소스**: [아카라이브 "나무위키 실검 알려주는 채널"](https://arca.live/b/namuhotnow) — 실시간 검색어 순위와 각 키워드가 뜬 이유를 제공합니다.
  - 각 게시글 = 하나의 실검 키워드 + 사람이 작성한 이유 설명

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

**도구 조회:**
```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

**도구 호출 (예: search):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": { "keyword": "이순신" }
  }
}
```

### 응답 형식

모든 도구는 아래 형식으로 응답합니다.

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"type\":\"search\",\"title\":\"이순신\",\"summary\":\"...\"}"
      }
    ]
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
│   ├── index.ts           # HTTP 서버 + JSON-RPC 핸들러
│   ├── types.ts           # 공통 타입 정의
│   ├── utils.ts           # 유틸리티 함수
│   ├── tools/
│   │   ├── search.ts              # 🔍 나무위키 문서 검색 (핵심)
│   │   ├── trending.ts            # 실검 TOP N
│   │   ├── why.ts                 # 실검 이유 설명
│   │   ├── history.ts             # 과거 이력
│   │   ├── velocity.ts            # 급상승 감지
│   │   ├── related.ts             # 연관 키워드
│   │   ├── trending-together.ts   # 함께 뜨는 키워드
│   │   └── trend-of-day.ts        # 종합 리포트
│   ├── scrapers/
│   │   ├── namuwiki.ts    # 나무위키 문서 파싱
│   │   └── arca.ts        # 아카라이브 실검채널 스크래핑
│   └── db/
│       ├── schema.ts      # SQLite 초기화
│       └── queries.ts     # DB CRUD 함수
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 라이선스

MIT
