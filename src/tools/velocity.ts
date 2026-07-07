import { z } from "zod";
import { getRecentSnapshots } from "../db/queries.js";
import type { VelocityResponse, VelocityKeyword, SnapshotRow } from "../types.js";

export const velocitySchema = {
  hours: z.number().optional().default(6).describe("분석할 시간 범위 (시간 단위, 기본 6시간)"),
  count: z.number().optional().default(10).describe("반환할 급상승 키워드 개수 (기본 10)"),
  min_views: z.number().optional().default(100).describe("최소 조회수 필터 (기본 100)"),
};

export async function velocity(args: { hours?: number; count?: number; min_views?: number }): Promise<VelocityResponse> {
  const hours = args.hours ?? 6;
  const count = args.count ?? 10;
  const minViews = args.min_views ?? 100;

  const recentSnapshots = getRecentSnapshots(hours);

  // 키워드별로 그룹화
  const keywordGroups = new Map<string, SnapshotRow[]>();
  for (const row of recentSnapshots) {
    if (!keywordGroups.has(row.keyword)) {
      keywordGroups.set(row.keyword, []);
    }
    keywordGroups.get(row.keyword)!.push(row);
  }

  const now = Date.now();
  const halfHoursAgo = new Date(now - (hours / 2) * 60 * 60 * 1000).toISOString();

  const velocityKeywords: VelocityKeyword[] = [];

  for (const [keyword, rows] of keywordGroups) {
    // 최근 30분 평균 vs 이전 N/2시간 평균
    const recent = rows.filter((r) => r.captured_at >= halfHoursAgo);
    const previous = rows.filter((r) => r.captured_at < halfHoursAgo);

    if (recent.length === 0 || previous.length === 0) continue;

    const currentAvg = recent.reduce((sum, r) => sum + r.views, 0) / recent.length;
    const previousAvg = previous.reduce((sum, r) => sum + r.views, 0) / previous.length;

    if (previousAvg === 0 || currentAvg < minViews) continue;

    // 증가율 = ((현재평균 - 이전평균) / 이전평균) × 100
    const growthRate = ((currentAvg - previousAvg) / previousAvg) * 100;

    if (growthRate <= 0) continue; // 증가한 키워드만

    velocityKeywords.push({
      keyword,
      growth_rate: Math.round(growthRate * 100) / 100,
      current_views: Math.round(currentAvg),
      previous_views: Math.round(previousAvg),
      category: rows[0].category,
    });
  }

  // 증가율 내림차순 정렬
  velocityKeywords.sort((a, b) => b.growth_rate - a.growth_rate);

  return {
    type: "velocity",
    analysis_hours: hours,
    keywords: velocityKeywords.slice(0, count),
  };
}