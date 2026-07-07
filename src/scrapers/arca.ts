import * as cheerio from "cheerio";
import { delay, fetchWithTimeout, classifyCategory, cleanKeyword, extractNumbers, nowISO } from "../utils.js";
import type { ArcaListItem, ArcaArticle } from "../types.js";

const LIST_URL = "https://arca.live/b/namuhotnow";
const ARTICLE_URL_BASE = "https://arca.live/b/namuhotnow";

/**
 * 아카라이브 목록 페이지를 스크래핑하여 최신 게시글 N개를 반환합니다.
 */
export async function scrapeList(count: number): Promise<ArcaListItem[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items: ArcaListItem[] = [];

  // 게시글 링크 패턴: <a href="/b/namuhotnow/{숫자}"...>
  const links = $("a").toArray();
  const postLinks = new Map<number, string>();

  for (const link of links) {
    const href = $(link).attr("href") || "";
    const match = href.match(/\/b\/namuhotnow\/(\d+)/);
    if (match) {
      const postId = parseInt(match[1], 10);
      const title = $(link).text().trim();
      if (title && title.length > 0 && !postLinks.has(postId)) {
        postLinks.set(postId, title);
      }
    }
  }

  // 모든 텍스트에서 숫자 추출 (조회수, 좋아요, 댓글)
  const pageText = $("body").text();
  const allNumbers = extractNumbers(pageText);

  let idx = 0;
  for (const [postId, title] of postLinks) {
    if (items.length >= count) break;

    // 마지막 3개의 숫자를 조회수/좋아요/댓글로 사용
    const numbers = allNumbers.slice(idx * 3, idx * 3 + 3);
    const views = numbers[0] ?? 0;
    const likes = numbers[1] ?? 0;
    const comments = numbers[2] ?? 0;

    items.push({
      postId,
      keyword: cleanKeyword(title),
      category: classifyCategory(title),
      views,
      likes,
      comments,
    });
    idx++;
  }

  return items;
}

/**
 * 아카라이브 게시글 상세 페이지를 스크래핑합니다.
 * 상세 페이지 요청 시 반드시 500ms delay 후 요청합니다.
 */
export async function scrapeArticle(postId: number): Promise<ArcaArticle | null> {
  await delay(500);

  const url = `${ARTICLE_URL_BASE}/${postId}`;
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // 본문 영역: 게시글 내용이 포함된 주요 div 영역
  // 모든 텍스트 노드를 수집하여 본문 구성
  let body = "";
  const articleContent = $("div.article-content, div.content, article, .content, .article").first();
  if (articleContent.length > 0) {
    body = articleContent.text().trim();
  } else {
    // fallback: body에서 모든 텍스트 수집
    body = $("body").text().trim();
  }

  // 2000자 제한
  if (body.length > 2000) {
    body = body.slice(0, 2000);
  }

  // 제목에서 키워드와 카테고리 추출
  const title = $("title").text().trim();
  const keyword = cleanKeyword(title);
  const category = classifyCategory(title);

  // 숫자 추출
  const numbers = extractNumbers($("body").text());
  const views = numbers[0] ?? 0;
  const likes = numbers[1] ?? 0;
  const comments = numbers[2] ?? 0;

  // 작성일시 추출 (시도)
  let postedAt = "";
  const timeElements = $("time, .time, .date, .written").first();
  if (timeElements.length > 0) {
    postedAt = timeElements.text().trim();
  }
  if (!postedAt) {
    postedAt = new Date().toISOString();
  }

  return {
    postId,
    keyword,
    category,
    body,
    views,
    likes,
    comments,
    postedAt,
  };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, 15_000);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}