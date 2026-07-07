import * as cheerio from "cheerio";
import { delay, fetchWithTimeout, fetchWithCookie } from "../utils.js";
import type { NamuWikiResult } from "../types.js";

const WIKI_URL_BASE = "https://namu.wiki/w";
const WIKI_HOME = "https://namu.wiki/";
const GOOGLE_CACHE = "https://webcache.googleusercontent.com/search?q=cache:";

/**
 * 나무위키 문서를 검색하여 첫 문단 요약을 추출합니다.
 * Vue.js SPA이므로 HTML 소스에서 모든 텍스트 노드를 수집합니다.
 * 요청 간격: 최소 300ms
 *
 * 접속 시도 순서:
 * 1차: namu.wiki 직접 접속
 * 2차: 쿠키 획득 후 재시도
 * 3차: Google Cache 우회 시도
 */
export async function scrapeWiki(keyword: string): Promise<NamuWikiResult | null> {
  await delay(300);

  const encodedKeyword = encodeURIComponent(keyword);
  const url = `${WIKI_URL_BASE}/${encodedKeyword}`;

  // 1차 시도: namu.wiki 직접 접속
  let result = await tryFetchWiki(url, keyword);
  if (result) return result;

  // 2차 시도: 쿠키 획득 후 재시도
  await delay(500);
  const { cookie } = await fetchWithCookie(WIKI_HOME);
  if (cookie) {
    await delay(300);
    result = await tryFetchWiki(url, keyword, cookie);
    if (result) return result;
  }

  // 3차 시도: Google Cache 우회
  await delay(300);
  result = await tryFetchFromGoogleCache(keyword, url);
  return result;
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function tryFetchFromGoogleCache(
  keyword: string,
  originalUrl: string
): Promise<NamuWikiResult | null> {
  const cacheUrl = `${GOOGLE_CACHE}${encodeURIComponent(originalUrl)}&strip=1`;
  try {
    const response = await fetchWithTimeout(cacheUrl, 15_000);
    if (!response.ok) return null;
    const html = await response.text();
    if (!html) return null;
    return parseWikiPage(html, keyword, originalUrl);
  } catch {
    return null;
  }
}

async function tryFetchWiki(
  url: string,
  keyword: string,
  cookie?: string
): Promise<NamuWikiResult | null> {
  let html: string | null = null;

  if (cookie) {
    const { response } = await fetchWithCookie(url, 15_000, cookie);
    if (!response || !response.ok) return null;
    html = await response.text();
  } else {
    try {
      const response = await fetchWithTimeout(url, 15_000);
      if (!response.ok) return null;
      html = await response.text();
    } catch {
      return null;
    }
  }

  if (!html) return null;

  // IP 차단 감지
  if (isBlocked(html)) return null;

  return parseWikiPage(html, keyword, url);
}

function isBlocked(html: string): boolean {
  const checkText = html.toLowerCase();
  return (
    checkText.includes("idc 대역 ip") ||
    checkText.includes("ip 우회 수단") ||
    checkText.includes("차단되었습니다") ||
    checkText.includes("blocked") ||
    checkText.includes("rate limit")
  );
}

function parseWikiPage(html: string, keyword: string, url: string): NamuWikiResult | null {
  const $ = cheerio.load(html);

  // 모든 텍스트 노드를 수집
  const allText: string[] = [];
  $("*")
    .contents()
    .toArray()
    .forEach((node) => {
      if (node.type === "text") {
        const text = (node as any).data?.trim();
        if (text && text.length >= 5) {
          allText.push(text);
        }
      }
    });

  // 전체 텍스트 결합 (50000자 제한)
  const fullText = allText.join(" ");
  const trimmedText = fullText.length > 50000 ? fullText.slice(0, 50000) : fullText;

  // 첫 3개의 완성된 문장을 요약으로 추출
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  const summarySentences = sentences.slice(0, 3);
  const summary = summarySentences.join(" ").trim();

  if (!summary || summary.length < 5) return null;

  // 8000자씩 분할
  const chunks = splitIntoChunks(trimmedText, 8000);

  // 문서 제목 추출
  let title = keyword;
  const titleElement = $("title").first().text().trim();
  if (titleElement) {
    const titleMatch = titleElement.match(/^(.+?)\s*-\s*나무위키/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }

  return {
    title,
    summary,
    url,
    chunks,
  };
}