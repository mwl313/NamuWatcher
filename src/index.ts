import http from "node:http";
import { initDb, getDb, closeDb } from "./db/schema.js";
import { trending } from "./tools/trending.js";
import { why } from "./tools/why.js";
import { searchTool } from "./tools/search.js";
import { history } from "./tools/history.js";
import { velocity } from "./tools/velocity.js";
import { related } from "./tools/related.js";
import { trendingTogether } from "./tools/trending-together.js";
import { trendOfDay } from "./tools/trend-of-day.js";
import { z } from "zod";

const PORT = parseInt(process.env.PORT || "3000", 10);

// Tool definitions
const TOOLS = [
  {
    name: "trending",
    description: "현재 나무위키 실시간 검색어 순위를 조회합니다. 사용자가 '지금 실검 뭐야?', '실시간 검색어 알려줘', '요즘 핫한 키워드', '실검 TOP 10', '오늘의 실검' 등으로 물으면 이 도구를 사용하세요. count로 개수(기본 10, 최대 20), category로 카테고리 필터(스포츠/인방/정치/일반/TV/커뮤)를 지정할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", default: 10, description: "조회할 실검 개수 (기본 10, 최대 20)" },
        category: { type: "string", description: "카테고리 필터 (스포츠/인방/정치/일반/TV/커뮤)" },
      },
    },
  },
  {
    name: "why",
    description: "특정 키워드가 왜 실시간 검색어에 올랐는지 이유를 설명합니다. 사용자가 '[키워드] 왜 떴어?', '[키워드] 무슨 일?', '[키워드] 이유가 뭐야?', '왜 [키워드]가 실검이야?' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: { type: "object", properties: { keyword: { type: "string", description: "궁금한 키워드" } }, required: ["keyword"] },
  },
  {
    name: "search",
    description: "나무위키 문서의 내용을 조회합니다. 사용자가 '[키워드]가 뭐야?', '[키워드] 알려줘', '[키워드] 정보' 등으로 물으면 이 도구를 사용하세요. 단, 실검 키워드에 대한 추가 설명을 요청할 때는 'why' 도구를 우선 사용하세요.",
    inputSchema: { type: "object", properties: { keyword: { type: "string", description: "나무위키에서 검색할 키워드" } }, required: ["keyword"] },
  },
  {
    name: "history",
    description: "과거 특정 날짜의 실시간 검색어 순위를 조회합니다. 사용자가 '어제 실검 뭐였어?', '7월 5일 실검', '[키워드] 며칠째 실검이야?', '지난주 실검' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "조회할 날짜 (YYYY-MM-DD 형식, 기본 오늘)" },
        keyword: { type: "string", description: "특정 키워드의 등장 이력 조회" },
        count: { type: "number", default: 10, description: "조회할 개수 (기본 10)" },
      },
    },
  },
  {
    name: "velocity",
    description: "최근 몇 시간 동안 조회수가 급상승한 키워드를 감지합니다. 사용자가 '급상승 키워드', '가장 빠르게 뜨는 거', '갑자기 올라온 키워드', '요즘 핫하게 뜨는 것' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: {
      type: "object",
      properties: {
        hours: { type: "number", default: 6, description: "분석할 시간 범위 (기본 6시간)" },
        count: { type: "number", default: 10, description: "반환할 개수 (기본 10)" },
        min_views: { type: "number", default: 100, description: "최소 조회수 (기본 100)" },
      },
    },
  },
  {
    name: "related",
    description: "특정 키워드와 함께 실시간 검색어에 자주 등장하는 연관 키워드를 찾습니다. 사용자가 '[키워드]랑 관련된 키워드', '[키워드]랑 같이 뜨는 것', '[키워드] 연관검색어' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: { type: "object", properties: { keyword: { type: "string", description: "기준 키워드" }, count: { type: "number", default: 10, description: "반환할 개수 (기본 10)" } }, required: ["keyword"] },
  },
  {
    name: "trending_together",
    description: "같은 시간대에 함께 실시간 검색어에 오르는 키워드 쌍을 분석합니다. 사용자가 '같이 뜨는 키워드', '함께 트렌딩', '실검 조합', '자주 같이 나오는 키워드' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: { type: "object", properties: { count: { type: "number", default: 20, description: "반환할 쌍 개수 (기본 20)" }, hours: { type: "number", default: 24, description: "분석할 시간 범위 (기본 24시간)" } } },
  },
  {
    name: "trend_of_day",
    description: "오늘의 실시간 검색어 종합 리포트를 생성합니다. 사용자가 '오늘 실검 요약', '오늘 하루 정리', '오늘의 리포트' 등으로 물으면 이 도구를 사용하세요.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleToolCall(name: string, args: any): Promise<any> {
  switch (name) {
    case "trending":
      return await trending(z.object({ count: z.number().optional().default(10), category: z.string().optional() }).parse(args || {}));
    case "why":
      return await why(z.object({ keyword: z.string() }).parse(args));
    case "search":
      return await searchTool(z.object({ keyword: z.string() }).parse(args));
    case "history":
      return await history(z.object({ date: z.string().optional(), keyword: z.string().optional(), count: z.number().optional().default(10) }).parse(args || {}));
    case "velocity":
      return await velocity(z.object({ hours: z.number().optional().default(6), count: z.number().optional().default(10), min_views: z.number().optional().default(100) }).parse(args || {}));
    case "related":
      return await related(z.object({ keyword: z.string(), count: z.number().optional().default(10) }).parse(args));
    case "trending_together":
      return await trendingTogether(z.object({ count: z.number().optional().default(20), hours: z.number().optional().default(24) }).parse(args || {}));
    case "trend_of_day":
      return await trendOfDay();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleJsonRpc(message: any): Promise<any> {
  const { method, params, id } = message;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "namu-watch", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    try {
      const data = await handleToolCall(params?.name, params?.arguments);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } };
    } catch (error: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: error?.message || "Internal error",
        },
      };
    }
  }

  return { jsonrpc: "2.0", id, result: {} };
}

async function main() {
  await initDb();

  const httpServer = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /healthz
    if (req.method === "GET" && req.url === "/healthz") {
      let dbOk = false;
      try { const db = getDb(); const stmt = db.prepare("SELECT 1"); stmt.step(); stmt.free(); dbOk = true; } catch { dbOk = false; }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime(), db: dbOk ? "connected" : "disconnected" }));
      return;
    }

    // POST /mcp
    if (req.method === "POST" && req.url === "/mcp") {
      let body = "";
      req.on("data", (chunk: string) => { body += chunk; });
      req.on("end", async () => {
        try {
          const message = JSON.parse(body);
          const response = await handleJsonRpc(message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch (error: any) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: error?.message || "Parse error" }, id: null }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(PORT, () => {
    console.log(`Namu Watch MCP server running on http://localhost:${PORT}`);
    console.log(`Healthcheck: http://localhost:${PORT}/healthz`);
    console.log(`MCP endpoint: POST http://localhost:${PORT}/mcp`);
  });

  process.on("SIGINT", () => { closeDb(); httpServer.close(); process.exit(0); });
  process.on("SIGTERM", () => { closeDb(); httpServer.close(); process.exit(0); });
}

main().catch(console.error);