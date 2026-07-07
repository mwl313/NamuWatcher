import { z } from "zod";
import { getTodayTotalKeywords, getTodayCategoryDistribution, getTodayTopKeywords, getRecentSnapshots } from "../db/queries.js";
import { todayDate } from "../utils.js";
import type { TrendOfDayResponse, TrendOfDaySummary, TrendingKeyword } from "../types.js";

export const trendOfDaySchema = {};

export async function trendOfDay(): Promise<TrendOfDayResponse> {
  const date = todayDate();

  const totalKeywords = getTodayTotalKeywords(date);
  const categoryDist = getTodayCategoryDistribution(date);
  const topKeywords = getTodayTopKeywords(date);

  // 급상승 키워드 TOP 5: 오늘 수집된 데이터 중 조회수 증가율 높은 순
  const todaySnapshots = getRecentSnapshots(24);
  const keywordGroups = new Map<string, { views: number[]; category: string; postId: number }[]>();

  for (const row of todaySnapshots) {
    if (!keywordGroups.has(row.keyword)) {
      keywordGroups.set(row.keyword, []);
    }
    keywordGroups.get(row.keyword)!.push({ views: [row.views], category: row.category, postId: row.post_id });
  }

  const fastestRisers: TrendingKeyword[] = [];
  for (const [keyword, entries] of keywordGroups) {
    if (entries.length < 2) continue;
    const views = entries.flatMap((e) => e.views);
    const firstViews = views[0];
    const lastViews = views[views.length - 1];
    if (firstViews === 0) continue;
    const growthRate = ((lastViews - firstViews) / firstViews) * 100;
    if (growthRate > 0) {
      fastestRisers.push({
        rank: 0,
        keyword,
        category: entries[0].category,
        views: lastViews,
        likes: 0,
        comments: 0,
        postId: entries[0].postId,
      });
    }
  }
  fastestRisers.sort((a, b) => b.views - a.views).slice(0, 5);

  const summary: TrendOfDaySummary = {
    total_keywords_tracked: totalKeywords,
    top_categories: categoryDist,
    top_keywords: topKeywords.slice(0, 5),
    fastest_risers: fastestRisers.slice(0, 5),
  };

  return {
    type: "trend_of_day",
    date,
    summary,
  };
}