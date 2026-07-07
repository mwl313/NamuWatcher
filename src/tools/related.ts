import { z } from "zod";
import { findRelatedKeywords } from "../db/queries.js";
import type { RelatedResponse } from "../types.js";

export const relatedSchema = {
  keyword: z.string().describe("연관 키워드를 찾을 기준 키워드"),
  count: z.number().optional().default(10).describe("반환할 연관 키워드 개수 (기본 10)"),
};

export async function related(args: { keyword: string; count?: number }): Promise<RelatedResponse> {
  const count = args.count ?? 10;
  const results = findRelatedKeywords(args.keyword, count);

  return {
    type: "related",
    keyword: args.keyword,
    related: results.map((r) => ({
      keyword: r.keyword,
      co_occurrence: r.co_occurrence,
      category: r.category,
    })),
  };
}