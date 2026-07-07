import { z } from "zod";
import { scrapeWiki } from "../scrapers/namuwiki.js";
import type { SearchResponse } from "../types.js";

export const searchSchema = {
  keyword: z.string().describe("나무위키에서 검색할 키워드"),
};

export async function searchTool(args: { keyword: string }): Promise<SearchResponse> {
  const result = await scrapeWiki(args.keyword);

  if (!result) {
    throw new Error(`"${args.keyword}"에 대한 나무위키 문서를 찾을 수 없습니다.`);
  }

  return {
    type: "search",
    title: result.title,
    summary: result.summary,
    url: result.url,
  };
}