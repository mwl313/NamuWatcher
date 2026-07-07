import * as cheerio from "cheerio";
import { delay, fetchWithTimeout, fetchWithCookie } from "../utils.js";
import type { NamuWikiResult } from "../types.js";

const WIKI_URL_BASE = "https://namu.wiki/w";
const WIKI_HOME = "https://namu.wiki/";

/**
 * 나무위키 문서를 검색하여 첫 문단 요약을 추출합니다.
 * Vue.js SPA이므로 HTML 소스에서 모든 텍스트 노드를 수집합니다.
 * 요청 간격: 최소 300ms
 * IP 차단 시 쿠키 획득 후 재시도합니다.
 */
export async function scrapeWiki(keyword: string): Promise<NamuWikiResult | null> {
  await delay(300);

  const encodedKeyword = encodeURIComponent(keyword);
  const url = `${WIKI_URL_BASE}/${encodedKeyword}`;

  // 1차 시도
  let result = await tryFetchWiki(url, keyword);
  if (result) return result;

  // 2차 시도: 쿠키 획득 후 재시도
  await delay(500);
  const { cookie } = await fetchWithCookie(WIKI_HOME);
  if (!cookie) return null;

  await delay(300);
  result = await tryFetchWiki(url, keyword, cookie);
  return result;
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

  // 첫 3개의 완성된 문장을 요약으로 추출
  const fullText = allText.join(" ");
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  const summarySentences = sentences.slice(0, 3);
  const summary = summarySentences.join(" ").trim();

  if (!summary || summary.length < 5) return null;

  // 50000자 제한
  const trimmedSummary = summary.length > 50000 ? summary.slice(0, 50000) : summary;

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
    summary: trimmedSummary,
    url,
  };
}