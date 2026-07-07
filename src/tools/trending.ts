import { z } from "zod";
import { scrapeList } from "../scrapers/arca.js";
import { insertSnapshots } from "../db/queries.js";
import { nowISO } from "../utils.js";
import type { TrendingResponse, TrendingKeyword } from "../types.js";

export const trendingSchema = {
  count: z.number().optional().default(10).describe("조회할 실검 개수 (기본 10, 최대 20)"),
  category: z.string().optional().describe("카테고리 필터 (스포츠/인방/정치/일반/TV/커뮤)"),
};

export async function trending(args: { count?: number; category?: string }): Promise<TrendingResponse> {
  const count = Math.min(args.count ?? 10, 20);
  const categoryFilter = args.category;

  const items = await scrapeList(count);

  let keywords: TrendingKeyword[] = items.map((item, idx) => ({
    rank: idx + 1,
    keyword: item.keyword,
    category: item.category,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    postId: item.postId,
  }));

  if (categoryFilter) {
    keywords = keywords.filter((k) => k.category === categoryFilter);
  }

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
    source: "arca.live",
  };
}