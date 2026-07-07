import * as cheerio from "cheerio";
import { delay, fetchWithTimeout } from "../utils.js";
import type { NamuWikiResult } from "../types.js";

const WIKI_URL_BASE = "https://namu.wiki/w";

/**
 * 나무위키 문서를 검색하여 첫 문단 요약을 추출합니다.
 * Vue.js SPA이므로 HTML 소스에서 모든 텍스트 노드를 수집합니다.
 * 요청 간격: 최소 300ms
 */
export async function scrapeWiki(keyword: string): Promise<NamuWikiResult | null> {
  await delay(300);

  const encodedKeyword = encodeURIComponent(keyword);
  const url = `${WIKI_URL_BASE}/${encodedKeyword}`;

  try {
    const response = await fetchWithTimeout(url, 15_000);
    if (!response.ok) return null;

    const html = await response.text();
    return parseWikiPage(html, keyword, url);
  } catch {
    return null;
  }
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

  // 2000자 제한
  const trimmedSummary = summary.length > 2000 ? summary.slice(0, 2000) : summary;

  // 문서 제목 추출
  let title = keyword;
  const titleElement = $("title").first().text().trim();
  if (titleElement) {
    // 나무위키 타이틀은 "제목 - 나무위키" 형식
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