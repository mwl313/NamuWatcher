import { z } from "zod";
import { scrapeWiki } from "../scrapers/namuwiki.js";
import type { SearchResponse } from "../types.js";

export const searchSchema = {
  keyword: z.string().describe("나무위키에서 검색할 키워드"),
};

export async function searchTool(args: { keyword: string }): Promise<SearchResponse> {
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

  const response: any = {
    type: "search",
    title: result.title,
    summary: result.summary,
    url: result.url,
  };

  if (args.keyword !== result.title) {
    response.note = `'${args.keyword}'를 찾을 수 없어 '${result.title}' 문서를 대신 표시합니다.`;
  }

  return response;
}