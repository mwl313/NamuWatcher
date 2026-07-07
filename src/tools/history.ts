import { z } from "zod";
import { getSnapshotsByDate, getSnapshotsByKeyword } from "../db/queries.js";
import { todayDate } from "../utils.js";
import type { HistoryResponse } from "../types.js";

export const historySchema = {
  date: z.string().optional().describe("조회할 날짜 (YYYY-MM-DD 형식, 기본 오늘)"),
  keyword: z.string().optional().describe("특정 키워드의 등장 이력 조회"),
  count: z.number().optional().default(10).describe("조회할 개수 (기본 10)"),
};

export async function history(args: { date?: string; keyword?: string; count?: number }): Promise<HistoryResponse> {
  const date = args.date || todayDate();
  const count = args.count ?? 10;
  const keyword = args.keyword;

  if (keyword) {
    // 특정 키워드의 시간별 등장 기록
    const appearances = getSnapshotsByKeyword(keyword, count);
    return {
      type: "history",
      keyword,
      appearances: appearances.map((a) => ({
        captured_at: a.captured_at,
        rank: a.rank,
        views: a.views,
      })),
    };
  }

  // 특정 날짜의 실검 순위
  const rows = getSnapshotsByDate(date, count);
  return {
    type: "history",
    date,
    keywords: rows.map((r) => ({
      rank: r.rank,
      keyword: r.keyword,
      views: r.views,
      likes: r.likes,
      category: r.category,
    })),
  };
}