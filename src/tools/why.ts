import { z } from "zod";
import { findArticleByKeyword, upsertArticle } from "../db/queries.js";
import { scrapeList, scrapeArticle } from "../scrapers/arca.js";
import { scrapeWiki } from "../scrapers/namuwiki.js";
import { nowISO } from "../utils.js";
import type { WhyResponse } from "../types.js";

export const whySchema = {
  keyword: z.string().describe("궁금한 키워드"),
};

export async function why(args: { keyword: string }): Promise<WhyResponse> {
  const keyword = args.keyword;

  // 1. DB 캐시 검색
  const cached = findArticleByKeyword(keyword);
  if (cached) {
    return {
      type: "why",
      keyword: cached.keyword,
      category: cached.category,
      reason: cached.body,
      source: "arca",
      source_url: `https://arca.live/b/namuhotnow/${cached.post_id}`,
      posted_at: cached.posted_at,
      views: cached.views,
      likes: cached.likes,
    };
  }

  // 2. 아카라이브 목록 50개 스크래핑 → 제목에 키워드가 포함된 게시글 찾기
  const items = await scrapeList(50);
  const matched = items.find((item) => item.keyword.includes(keyword) || keyword.includes(item.keyword));

  if (matched) {
    // 상세 페이지 스크래핑
    const article = await scrapeArticle(matched.postId);
    if (article) {
      // DB UPSERT
      upsertArticle({
        post_id: article.postId,
        keyword: article.keyword,
        category: article.category,
        body: article.body,
        views: article.views,
        likes: article.likes,
        comments: article.comments,
        posted_at: article.postedAt,
        fetched_at: nowISO(),
      });

      return {
        type: "why",
        keyword: article.keyword,
        category: article.category,
        reason: article.body,
        source: "arca",
        source_url: `https://arca.live/b/namuhotnow/${article.postId}`,
        posted_at: article.postedAt,
        views: article.views,
        likes: article.likes,
      };
    }
  }

  // 3. 나무위키 fallback
  const wikiResult = await scrapeWiki(keyword);
  if (wikiResult) {
    return {
      type: "why",
      keyword,
      category: "기타",
      reason: wikiResult.summary,
      source: "namuwiki",
      source_url: wikiResult.url,
      posted_at: "",
      views: 0,
      likes: 0,
    };
  }

  // 4. 없음
  throw new Error(`"${keyword}"에 대한 정보를 찾을 수 없습니다.`);
}