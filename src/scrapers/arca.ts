import * as cheerio from "cheerio";
import { delay, fetchWithTimeout, classifyCategory, cleanKeyword, extractNumbers } from "../utils.js";
import type { ArcaListItem, ArcaArticle } from "../types.js";

const LIST_URL = "https://arca.live/b/namuhotnow";
const ARTICLE_URL_BASE = "https://arca.live/b/namuhotnow";

/**
 * 아카라이브 목록 페이지를 스크래핑하여 최신 게시글 N개를 반환합니다.
 * 각 게시글 엘리먼트 내에서만 조회수/좋아요/댓글을 추출합니다.
 */
export async function scrapeList(count: number): Promise<ArcaListItem[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items: ArcaListItem[] = [];
  const processedPostIds = new Set<number>();

  // 아카라이브 목록 페이지의 각 게시글은 <tr> 또는 .list-item 등 특정 컨테이너에 있음
  // 1. 먼저 모든 <a> 링크에서 게시글 ID와 제목을 수집
  $("a").each((_, linkEl) => {
    if (items.length >= count) return false;

    const href = $(linkEl).attr("href") || "";
    const match = href.match(/\/b\/namuhotnow\/(\d+)/);
    if (!match) return;

    const postId = parseInt(match[1], 10);
    if (processedPostIds.has(postId)) return;

    const title = $(linkEl).text().trim();
    if (!title || title.length === 0) return;

    processedPostIds.add(postId);

    // 2. 이 링크가 속한 가장 가까운 부모 컨테이너 찾기
    // <tr>이 일반적이지만, <div>나 <li>일 수도 있음
    const parentRow = $(linkEl).closest("tr, div.list-item, li, .table-row, [class*='row']").first();

    let views = 0;
    let likes = 0;
    let comments = 0;

    if (parentRow.length > 0) {
      // 부모 컨테이너 내의 텍스트에서 숫자 추출
      const rowNumbers = extractNumbers(parentRow.text());
      // 일반적으로 조회수/좋아요/댓글 순서로 노출됨
      views = rowNumbers[0] ?? 0;
      likes = rowNumbers[1] ?? 0;
      comments = rowNumbers[2] ?? 0;
    } else {
      // 부모를 못 찾았으면 링크 주변만 스코프로 제한
      const parent = $(linkEl).parent();
      const scope = parent.length > 0 ? parent : $(linkEl);
      const numbers = extractNumbers(scope.text());
      views = numbers[0] ?? 0;
      likes = numbers[1] ?? 0;
      comments = numbers[2] ?? 0;
    }

    items.push({
      postId,
      keyword: cleanKeyword(title),
      category: classifyCategory(title),
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

  // 본문 영역: 게시글 내용이 포함된 주요 div 영역
  let body = "";
  const articleContent = $("div.article-content, div.content, article, .content, .article").first();
  if (articleContent.length > 0) {
    body = articleContent.text().trim();
  } else {
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

  // 상세 페이지의 stats 영역에서 조회수/좋아요/댓글 추출
  // 상세 페이지에서는 게시글 본문이 아닌 사이드/상단 stats 영역의 숫자가 더 관련 있음
  const statSelectors = ".stats, .vote, .status, .info, [class*='stat'], [class*='vote'], [class*='info']";
  let statsText = "";
  $(statSelectors).each((_, el) => {
    statsText += " " + $(el).text();
  });

  let numbers: number[];
  if (statsText.trim()) {
    numbers = extractNumbers(statsText);
  } else {
    // fallback: 전체 body에서 숫자 추출
    numbers = extractNumbers($("body").text());
  }

  const views = numbers[0] ?? 0;
  const likes = numbers[1] ?? 0;
  const comments = numbers[2] ?? 0;

  // 작성일시 추출
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