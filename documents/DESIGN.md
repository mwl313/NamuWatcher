# Namu Watch — Design Document

> **Project**: Namu Watch — 나무위키 실시간 검색어 모니터링 MCP 서버
> **대회**: AGENTIC PLAYER 10 (카카오 PlayMCP)
> **버전**: 1.0.0
> **작성일**: 2026-07-07

---

## 1. 프로젝트 개요

### 1.1. 목적
사용자가 카카오톡 AI 비서에게 "@나무워치" 라고 말하면,
**지금 한국 인터넷에서 뭐가 뜨고 있고, 왜 뜨는지** 알려주는 MCP 서버.

### 1.2. 핵심 가치
- "실검 뭐야?" 한마디로 실시간 검색어 TOP 20 확인
- "왜 떴어?" 한마디로 각 키워드가 실검에 오른 이유 설명
- "어제 실검 뭐였어?" 로 과거 이력 조회
- "급상승 키워드 뭐야?" 로 조회수 급증 키워드 감지

### 1.3. 타겟 사용자
- 카카오톡 이용자 5,000만 명 (본선 투표권자)
- 실시간 검색어를 궁금해하는 모든 한국인

---

## 2. 데이터 소스

### 2.1. 아카라이브 "나무위키 실검 알려주는 채널" (주 소스)
- URL: `https://arca.live/b/namuhotnow`
- 개별 게시글: `https://arca.live/b/namuhotnow/{postId}`
- 인증 불필요, HTTP GET 만으로 접근 가능
- 각 게시글 = **하나의 실검 키워드 + 사람이 작성한 이유 설명**
- 게시글에는 카테고리(스포츠/인방/정치/일반/TV/커뮤), 조회수, 좋아요, 댓글 수 포함

**카테고리 추출 규칙 (이모지 기반):**
- `⚽️` 또는 "스포츠" → `스포츠`
- `🎙️` 또는 "인방" → `인방`
- `🤔` 또는 "일반" → `일반`
- `📺` 또는 "TV" → `TV`
- `⚖️` 또는 "정치" → `정치`
- `🔎` 또는 "커뮤" → `커뮤`
- 해당 없음 → `기타`

**목록 페이지 HTML 구조:**
- 게시글 링크 패턴: `<a href="/b/namuhotnow/{숫자}"...>`
- 게시글 제목 = 키워드명 (한글, 100자 이내)
- 조회수/좋아요/댓글 = HTML 텍스트에서 정규식으로 숫자 추출 (마지막 3개 숫자)

**상세 페이지:**
- 본문 영역: 게시글 내용이 포함된 주요 div 영역
- 모든 텍스트 노드를 수집하여 본문 구성

### 2.2. 나무위키 (보조 소스)
- URL: `https://namu.wiki/w/{URL인코딩된제목}`
- 아카라이브에 없는 키워드 검색 시 fallback
- Vue.js SPA이므로 HTML 소스에서 모든 텍스트 노드를 수집
- 5글자 이상의 텍스트만 유효한 문장으로 취급
- 첫 3개의 완성된 문장을 요약으로 추출
- 2000자 제한

---

## 3. 제공 도구 (8개)

### 3.1. `trending` — 현재 실시간 검색어 TOP N
- **동작**: 아카라이브 목록 페이지 스크래핑 → 최신 게시글 N개 수집
- **파라미터**: 
  - `count` (선택, 기본 10, 최대 20) — 몇 개 볼지
  - `category` (선택) — 특정 카테고리만 보고 싶을 때 (스포츠/인방/정치/일반/TV/커뮤)
- **반환**: 순위, 키워드명, 카테고리, 조회수, 좋아요수, 댓글수
- **부수효과**: 스크래핑한 데이터를 SQLite DB에 자동 저장 (히스토리용)

### 3.2. `why` — 특정 키워드가 실검에 오른 이유
- **동작**: 
  1. DB `articles` 테이블에서 `LIKE '%키워드%'` 검색 (캐시)
  2. 없으면 아카라이브 목록 50개 스크래핑 → 제목에 키워드가 **포함**된 게시글 찾기
  3. 찾으면 해당 게시글 상세 페이지 스크래핑 → DB UPSERT → 반환
  4. 아카라이브에도 없으면 나무위키 문서로 fallback
- **파라미터**: `keyword` (필수) — 궁금한 키워드
- **반환**: 키워드명, 카테고리, 이유 설명, 출처 URL, 출처(arca/namuwiki 중 어떤 소스인지)

### 3.3. `search` — 나무위키 문서 검색
- **동작**: 나무위키 페이지 HTML 파싱 → 첫 문단 요약 추출
- **파라미터**: `keyword` (필수) — 검색할 키워드
- **반환**: 문서 제목, 요약, URL
- **주의**: 실검 키워드의 이유를 물을 땐 `why` 도구가 우선되어야 함

### 3.4. `history` — 과거 실검 조회
- **동작**: SQLite DB에 저장된 스냅샷 데이터 조회
- **파라미터**:
  - `date` (선택, 기본 오늘) — "YYYY-MM-DD" 형식
  - `keyword` (선택) — 특정 키워드의 등장 이력을 보고 싶을 때
  - `count` (선택, 기본 10)
- **반환**: 날짜, 키워드 목록(순위/키워드명/조회수) 또는 특정 키워드의 시간별 등장 기록

### 3.5. `velocity` — 급상승 키워드 감지
- **동작**: DB에 저장된 시간별 스냅샷을 비교하여 조회수 증가율 계산
  - 최근 30분 평균 조회수 vs 이전 N시간 평균 조회수 비교
  - 증가율 = ((현재평균 - 이전평균) / 이전평균) × 100
  - 증가한 키워드만, 최소 조회수 이상만 필터링
- **파라미터**:
  - `hours` (선택, 기본 6) — 분석할 시간 범위
  - `count` (선택, 기본 10)
  - `min_views` (선택, 기본 100) — 최소 조회수 필터
- **반환**: 키워드명, 증가율(%), 현재조회수, 이전조회수, 카테고리

### 3.6. `related` — 연관 키워드
- **동작**: 아카라이브 게시글 제목이 쉼표로 여러 키워드를 포함하는 점 활용
  - DB에서 해당 키워드가 포함된 게시글 검색
  - 같은 게시글에 함께 등장한 다른 키워드 집계
- **파라미터**: `keyword` (필수), `count` (선택, 기본 10)
- **반환**: 기준 키워드, 연관 키워드 목록(키워드명, 동시등장횟수, 카테고리)

### 3.7. `trending_together` — 함께 뜨는 키워드 쌍
- **동작**: 동시간대 DB 스냅샷에서 함께 등장한 키워드 쌍 분석
- **파라미터**: `count` (선택, 기본 20), `hours` (선택, 기본 24)
- **반환**: 키워드 쌍 목록(키워드1, 키워드2, 동시등장빈도, 카테고리)

### 3.8. `trend_of_day` — 오늘 종합 리포트
- **동작**: 오늘 DB 데이터를 종합하여 리포트 생성
  - 오늘 수집된 총 키워드 수
  - 카테고리별 분포
  - 가장 많이 등장한 키워드 TOP 5
  - 급상승 키워드 TOP 5
- **파라미터**: 없음
- **반환**: 날짜, 총 키워드 수, 카테고리 분포, TOP 키워드, 급상승 키워드

---

## 4. 각 도구의 설명 (AI 자연어 매핑용)

Cline이 이 설명을 그대로 각 도구의 `description` 필드에 넣어야 함.
AI가 사용자의 자연어 질문을 어떤 도구에 매핑할지 결정하는 핵심.

| 도구 | 설명 |
|:-----|:------|
| `trending` | "현재 나무위키 실시간 검색어 순위를 조회합니다. 사용자가 '지금 실검 뭐야?', '실시간 검색어 알려줘', '요즘 핫한 키워드', '실검 TOP 10', '오늘의 실검' 등으로 물으면 이 도구를 사용하세요. count로 개수(기본 10, 최대 20), category로 카테고리 필터(스포츠/인방/정치/일반/TV/커뮤)를 지정할 수 있습니다." |
| `why` | "특정 키워드가 왜 실시간 검색어에 올랐는지 이유를 설명합니다. 사용자가 '[키워드] 왜 떴어?', '[키워드] 무슨 일?', '[키워드] 이유가 뭐야?', '왜 [키워드]가 실검이야?' 등으로 물으면 이 도구를 사용하세요." |
| `search` | "나무위키 문서의 내용을 조회합니다. 사용자가 '[키워드]가 뭐야?', '[키워드] 알려줘', '[키워드] 정보' 등으로 물으면 이 도구를 사용하세요. 단, 실검 키워드에 대한 추가 설명을 요청할 때는 'why' 도구를 우선 사용하세요." |
| `history` | "과거 특정 날짜의 실시간 검색어 순위를 조회합니다. 사용자가 '어제 실검 뭐였어?', '7월 5일 실검', '[키워드] 며칠째 실검이야?', '지난주 실검' 등으로 물으면 이 도구를 사용하세요." |
| `velocity` | "최근 몇 시간 동안 조회수가 급상승한 키워드를 감지합니다. 사용자가 '급상승 키워드', '가장 빠르게 뜨는 거', '갑자기 올라온 키워드', '요즘 핫하게 뜨는 것' 등으로 물으면 이 도구를 사용하세요." |
| `related` | "특정 키워드와 함께 실시간 검색어에 자주 등장하는 연관 키워드를 찾습니다. 사용자가 '[키워드]랑 관련된 키워드', '[키워드]랑 같이 뜨는 것', '[키워드] 연관검색어' 등으로 물으면 이 도구를 사용하세요." |
| `trending_together` | "같은 시간대에 함께 실시간 검색어에 오르는 키워드 쌍을 분석합니다. 사용자가 '같이 뜨는 키워드', '함께 트렌딩', '실검 조합', '자주 같이 나오는 키워드' 등으로 물으면 이 도구를 사용하세요." |
| `trend_of_day` | "오늘의 실시간 검색어 종합 리포트를 생성합니다. 사용자가 '오늘 실검 요약', '오늘 하루 정리', '오늘의 리포트' 등으로 물으면 이 도구를 사용하세요." |

---

## 5. 데이터 흐름

```
[사용자] → "@나무워치 지금 실검 뭐야?"
    ↓ Kakao Tools AI가 "trending" 도구 호출 판단
[우리 MCP 서버] → trending() 호출
    ↓
[아카라이브] GET /b/namuhotnow → HTML
    ↓ cheerio 파싱
[SQLite DB] snapshots 테이블에 자동 저장
    ↓
[응답] JSON 구조화된 데이터 → AI가 자연어로 변환 → 사용자
```

### 데이터 저장 정책
- `trending` 호출 시 스크래핑 결과를 무조건 `snapshots` 테이블에 INSERT
- `why` 호출 시 가져온 게시글 본문을 `articles` 테이블에 UPSERT (캐시)
- DB는 영구 볼륨에 저장 (컨테이너 재시작 유지)

---

## 6. 데이터베이스

### 6.1. snapshots 테이블
스크래핑할 때마다 저장되는 실검 순위 스냅샷.

| 컬럼 | 타입 | 설명 |
|:-----|:-----|:------|
| id | INTEGER PK AUTOINCREMENT | |
| captured_at | TEXT (datetime) | 스크래핑 시각 |
| rank | INTEGER | 순위 (1~N) |
| keyword | TEXT | 키워드명 |
| category | TEXT | 카테고리 (스포츠/인방/정치/일반/TV/커뮤) |
| views | INTEGER | 조회수 |
| likes | INTEGER | 좋아요 수 |
| comments | INTEGER | 댓글 수 |
| post_id | INTEGER | 아카라이브 게시글 ID |

인덱스: captured_at, keyword

### 6.2. articles 테이블
아카라이브 게시글 본문 캐시.

| 컬럼 | 타입 | 설명 |
|:-----|:-----|:------|
| post_id | INTEGER PK | 아카라이브 게시글 ID |
| keyword | TEXT | 키워드명 |
| category | TEXT | 카테고리 |
| body | TEXT | 게시글 본문 (실검 이유) |
| views | INTEGER | 조회수 |
| likes | INTEGER | 좋아요 수 |
| comments | INTEGER | 댓글 수 |
| posted_at | TEXT | 아카라이브 작성일시 |
| fetched_at | TEXT | 우리 서버가 가져온 시각 |

인덱스: keyword

---

## 7. 기술 스택

| 항목 | 요구사항 |
|:-----|:---------|
| **언어** | TypeScript (Node.js 20+) |
| **MCP SDK** | @modelcontextprotocol/sdk |
| **HTTP** | Node.js 내장 http 모듈 (Express 불필요) |
| **HTML 파싱** | cheerio |
| **데이터베이스** | better-sqlite3 (SQLite) |
| **입력 검증** | zod + zod-to-json-schema |
| **배포** | Docker, linux/amd64 |
| **알파인 패키지** | python3 + make + g++ (better-sqlite3 네이티브 빌드용) |

---

## 8. API 명세

### 8.1. 엔드포인트

| 메서드 | 경로 | 설명 |
|:-------|:-----|:------|
| POST | `/mcp` | MCP Streamable HTTP (JSON-RPC) |
| GET | `/healthz` | 헬스체크 (상태 JSON 반환) |
| OPTIONS | `*` | CORS preflight |

### 8.2. MCP 프로토콜
- 버전: `2025-03-26`
- Transport: Streamable HTTP (단일 POST, 단일 JSON 응답)
- SSE 불필요
- JSON-RPC 메시지 교환

### 8.3. 응답 형식
모든 도구는 아래 형식으로 응답. `text` 필드 안에 JSON 문자열을 넣어 구조화된 데이터 전달.
AI가 이 JSON을 읽고 자연어로 변환함.

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"type\":\"trending\",\"captured_at\":\"2026-07-07T19:00:00\",\"keywords\":[{\"rank\":1,\"keyword\":\"호날두\",...}]}"
    }
  ]
}
```

**각 도구별 응답에 포함되어야 할 필드:**
- `trending`: `type`, `captured_at`, `total`, `keywords[{rank, keyword, category, views, likes, comments, postId}]`, `source`
- `why`: `type`, `keyword`, `category`, `reason`, `source`("arca"|"namuwiki"), `source_url`, `posted_at`, `views`, `likes`
- `search`: `type`, `title`, `summary`, `url`
- `history`: `type`, `date`, `keywords[{rank, keyword, views, likes, category}]` 또는 `keyword`, `appearances[{captured_at, rank, views}]`
- `velocity`: `type`, `analysis_hours`, `keywords[{keyword, growth_rate, current_views, previous_views, category}]`
- `related`: `type`, `keyword`, `related[{keyword, co_occurrence, category}]`
- `trending_together`: `type`, `analysis_hours`, `pairs[{keywords:[k1,k2], frequency, categories:[c1,c2]}]`
- `trend_of_day`: `type`, `date`, `summary:{total_keywords_tracked, top_categories[{category,count}], top_keywords[{keyword,rank}], fastest_risers}`

**에러 응답:**
- `{ "content": [{ "type": "text", "text": "{\"type\":\"error\",\"message\":\"...\"}" }], "isError": true }`

---

## 9. 배포

### 9.1. Docker 요구사항
- Base image: `node:20-alpine`
- 필수 추가 패키지: `python3`, `make`, `g++` (better-sqlite3 네이티브 모듈)
- 아키텍처: **linux/amd64** (Apple Silicon은 `--platform linux/amd64`)
- 포트: 3000
- 볼륨: `/app/data/` (SQLite DB 저장)
- Healthcheck: `/healthz` 엔드포인트 30초 간격
- 실행 유저: `node` (root 금지)

### 9.2. 환경 변수
| 변수 | 기본값 | 설명 |
|:-----|:-------|:------|
| PORT | 3000 | HTTP 서버 포트 |
| DB_PATH | /app/data/namu_watch.db | SQLite 파일 경로 |
| NODE_ENV | production | 실행 모드 |

---

## 10. 프로젝트 구조 (Cline이 생성할 것)

```
namu-watch/
├── src/
│   ├── index.ts           # HTTP 서버 (POST /mcp, GET /healthz, CORS)
│   ├── mcp-server.ts      # MCP Server 객체 + 핸들러
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
├── package.json
├── tsconfig.json
├── Dockerfile
├── .dockerignore
└── .gitignore
```

---

## 11. 주의사항 및 제약

### 11.1. MCP 서버 필수 요구사항
- Streamable HTTP: 단일 `POST /mcp` 엔드포인트 (SSE/stdio 금지)
- CORS 헤더 필수 (Origin, Methods, Headers)
- GET /healthz 헬스체크 필수
- 타임아웃 30초 이상

### 11.2. 데이터 스크래핑 주의사항
- 아카라이브 요청 간격: 최소 **500ms** (안전하게)
- 나무위키 요청 간격: 최소 **300ms**
- 두 스크래퍼 모두 fetch API 사용 (axios 불필요)
- User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` (고정값)
- Accept-Language: `ko-KR,ko;q=0.9` (나무위키 한국어 설정)
- 스크래핑 실패 시 재시도 없이 null 반환 (장애 시간 최소화)
- 아카라이브 상세 페이지는 반드시 `delay(500)` 후 요청 (목록 페이지는 delay 불필요)

### 11.3. 도구 설명 중요성
- 각 도구의 `description`은 AI가 자연어를 도구에 매핑하는 유일한 단서
- description은 반드시 한글로, 다양한 질문 예시를 포함하여 상세히 작성
- "~하면 이 도구를 사용하세요" 형식으로 AI에게 명확한 가이드 제공

### 11.4. Docker 빌드
- 반드시 linux/amd64 플랫폼 (PlayMCP in KC 요구사항)
- better-sqlite3는 네이티브 모듈이므로 alpine에 `python3`, `make`, `g++` 필수 설치
- `npm ci --only=production` 으로 의존성 설치 (devDeps 제외)
- `node` 사용자로 실행 (root 금지)
- `/app/data/` 디렉토리 미리 생성 + node 유저 소유권 설정
- Healthcheck: 30초 간격, 5초 타임아웃, 3회 실패 시 unhealthy
