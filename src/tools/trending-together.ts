import { z } from "zod";
import { getRecentSnapshots } from "../db/queries.js";
import type { TrendingTogetherResponse, TrendingTogetherPair, SnapshotRow } from "../types.js";

export const trendingTogetherSchema = {
  count: z.number().optional().default(20).describe("반환할 키워드 쌍 개수 (기본 20)"),
  hours: z.number().optional().default(24).describe("분석할 시간 범위 (기본 24시간)"),
};

export async function trendingTogether(args: { count?: number; hours?: number }): Promise<TrendingTogetherResponse> {
  const count = args.count ?? 20;
  const hours = args.hours ?? 24;

  const snapshots = getRecentSnapshots(hours);

  // 같은 captured_at(동시간대)에 함께 등장한 키워드 쌍 분석
  const timeGroups = new Map<string, SnapshotRow[]>();
  for (const row of snapshots) {
    // 분 단위까지 동일하면 같은 스냅샷으로 간주
    const timeKey = row.captured_at.slice(0, 16);
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, []);
    }
    timeGroups.get(timeKey)!.push(row);
  }

  const pairMap = new Map<string, { frequency: number; category1: string; category2: string }>();

  for (const [, rows] of timeGroups) {
    const keywords = [...new Set(rows.map((r) => r.keyword))]; // 중복 제거
    const categories = new Map<string, string>();
    for (const r of rows) {
      if (!categories.has(r.keyword)) {
        categories.set(r.keyword, r.category);
      }
    }

    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const k1 = keywords[i];
        const k2 = keywords[j];
        const pairKey = [k1, k2].sort().join("::");
        const existing = pairMap.get(pairKey);
        if (existing) {
          existing.frequency++;
        } else {
          pairMap.set(pairKey, {
            frequency: 1,
            category1: categories.get(k1) || "기타",
            category2: categories.get(k2) || "기타",
          });
        }
      }
    }
  }

  const pairs: TrendingTogetherPair[] = [];
  for (const [pairKey, data] of pairMap) {
    const [kw1, kw2] = pairKey.split("::");
    pairs.push({
      keywords: [kw1, kw2],
      frequency: data.frequency,
      categories: [data.category1, data.category2],
    });
  }

  // 빈도 내림차순 정렬
  pairs.sort((a, b) => b.frequency - a.frequency);

  return {
    type: "trending_together",
    analysis_hours: hours,
    pairs: pairs.slice(0, count),
  };
}