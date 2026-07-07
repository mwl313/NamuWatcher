import * as cheerio from "cheerio";
import { delay, fetchWithTimeout, classifyCategory, cleanKeyword, extractNumbers } from "../utils.js";
import type { ArcaListItem, ArcaArticle } from "../types.js";

const LIST_URL = "https://arca.live/b/namuhotnow";
const ARTICLE_URL_BASE = "https://arca.live/b/namuhotnow";

/**
 * 아카라이브 목록 페이지를 스크래핑하여 최신 게시글 N개를 반환합니다.
 * 각 게시글의 vrow 구조에서 제목과 통계를 추출하며, 공지글(.notice)은 제외합니다.
 */
export async function scrapeList(count: number): Promise<ArcaListItem[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items: ArcaListItem[] = [];
  const processedPostIds = new Set<number>();

  $('a.vrow.column').not('.notice').each((_, linkEl) => {
    const href = $(linkEl).attr('href') || '';
    const match = href.match(/\/b\/namuhotnow\/(\d+)/);
    if (!match) return;

    const postId = parseInt(match[1], 10);
    if (processedPostIds.has(postId)) return;

    const vrowInner = $(linkEl).find('.vrow-inner');
    const vrowTop = vrowInner.find('.vrow-top').text().trim();
    const vrowBottom = vrowInner.find('.vrow-bottom').text().trim();

    if (!vrowTop) return;

    processedPostIds.add(postId);

    const numbers = extractNumbers(vrowBottom || $(linkEl).text());
    const views = numbers[0] ?? 0;
    const likes = numbers[1] ?? 0;
    const comments = numbers[2] ?? 0;

    items.push({
      postId,
      keyword: cleanKeyword(vrowTop),
      category: classifyCategory(vrowTop),
      views,
      likes,
      comments,
    });
  });

  return items.slice(0, count);
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

  // 본문 영역
  let body = "";
  const articleContent = $("div.article-content, div.content, article, .content, .article").first();
  if (articleContent.length > 0) {
    body = articleContent.text().trim();
  } else {
    body = $("body").text().trim();
  }

  if (body.length > 2000) {
    body = body.slice(0, 2000);
  }

  const title = $("title").text().trim();
  const keyword = cleanKeyword(title);
  const category = classifyCategory(title);

  // 통계 영역에서 조회수/좋아요/댓글 추출
  const statSelectors = ['.stats', '.vote', '.status', '.info', '[class*="stat"]', '[class*="vote"]', '[class*="info"]', '.vrow-bottom'];
  let statsText = '';
  for (const sel of statSelectors) {
    const el = $(sel).first();
    if (el.length > 0) { statsText = el.text().trim(); break; }
  }
  let numbers: number[];
  if (statsText) {
    numbers = extractNumbers(statsText);
  } else {
    numbers = extractNumbers($('body').text());
  }

  const views = numbers[0] ?? 0;
  const likes = numbers[1] ?? 0;
  const comments = numbers[2] ?? 0;

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