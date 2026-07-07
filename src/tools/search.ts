import { z } from "zod";
import { scrapeWiki } from "../scrapers/namuwiki.js";

export const searchSchema = {
  keyword: z.string().describe("나무위키에서 검색할 키워드"),
};

export async function searchTool(args: { keyword: string }): Promise<{ content: { type: "text"; text: string }[] }> {
  let result = await scrapeWiki(args.keyword);

  if (!result) {
    const words = args.keyword.split(/\s+/);
    for (let i = words.length - 1; i >= 1; i--) {
      const shortened = words.slice(0, i).join(" ");
      if (shortened.length > 0) {
        result = await scrapeWiki(shortened);
        if (result) break;
      }
    }
  }

  if (!result) {
    throw new Error(`"${args.keyword}"에 대한 나무위키 문서를 찾을 수 없습니다.`);
  }

  const totalChunks = result.chunks.length;
  const content: { type: "text"; text: string }[] = [];

  // 첫 블록: 메타정보 JSON
  const meta: any = {
    type: "search",
    title: result.title,
    url: result.url,
    total_chunks: totalChunks,
  };
  if (args.keyword !== result.title) {
    meta.note = `'${args.keyword}'를 찾을 수 없어 '${result.title}' 문서를 대신 표시합니다.`;
  }
  content.push({ type: "text", text: JSON.stringify(meta) });

  // 그 다음: chunks 개수만큼 "[i/total] 본문" 형식으로 블록 추가
  for (let i = 0; i < totalChunks; i++) {
    const chunkLabel = `[${i + 1}/${totalChunks}]`;
    content.push({ type: "text", text: `${chunkLabel}\n${result.chunks[i]}` });
  }

  return { content };
}