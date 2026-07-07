import { z } from "zod";
import { fetchRanking } from "../scrapers/ranking.js";
import { insertSnapshots } from "../db/queries.js";
import { nowISO } from "../utils.js";
import type { TrendingResponse, TrendingKeyword } from "../types.js";

export const trendingSchema = {
  count: z.number().optional().default(10).describe("조회할 실검 개수 (기본 10, 최대 10)"),
  category: z.string().optional().describe("카테고리 필터 (스포츠/인방/정치/일반/TV/커뮤) — API 기반에서는 미지원)"),
};

export async function trending(args: { count?: number; category?: string }): Promise<TrendingResponse> {
  const count = Math.min(args.count ?? 10, 10);

  const items = await fetchRanking(count);

  let keywords: TrendingKeyword[] = items.map((item) => ({
    rank: item.rank,
    keyword: item.keyword,
    category: args.category || "기타",
    views: 0,
    likes: 0,
    comments: 0,
    postId: 0,
  }));

  const capturedAt = nowISO();

  // Save to DB
  const snapshotRows = keywords.map((k) => ({
    captured_at: capturedAt,
    rank: k.rank,
    keyword: k.keyword,
    category: k.category,
    views: k.views,
    likes: k.likes,
    comments: k.comments,
    post_id: k.postId,
  }));
  insertSnapshots(snapshotRows);

  return {
    type: "trending",
    captured_at: capturedAt,
    total: keywords.length,
    keywords,
    source: "search.namu.wiki",
  };
}