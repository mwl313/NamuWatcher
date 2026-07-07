import { fetchWithTimeout } from "../utils.js";

const RANKING_API = "https://search.namu.wiki/api/ranking";

/**
 * 나무위키 공식 실검 API에서 랭킹 데이터를 가져옵니다.
 * @param count 가져올 키워드 개수 (최대 10)
 * @returns [{ rank: number, keyword: string }, ...] 형태의 배열
 */
export async function fetchRanking(count: number): Promise<{ rank: number; keyword: string }[]> {
  try {
    const response = await fetchWithTimeout(RANKING_API, 10_000);
    if (!response.ok) return [];

    const data = await response.json() as any;

    // API 응답 구조에 따라 파싱 (배열 또는 {data: [...]} 형태일 수 있음)
    let items: { rank: number; keyword: string }[] = [];

    if (Array.isArray(data)) {
      items = data.slice(0, Math.min(count, 10)).map((item: any, idx: number) => ({
        rank: idx + 1,
        keyword: item.keyword || item.name || item.title || String(item),
      }));
    } else if (data?.data && Array.isArray(data.data)) {
      items = data.data.slice(0, Math.min(count, 10)).map((item: any, idx: number) => ({
        rank: idx + 1,
        keyword: item.keyword || item.name || item.title || String(item),
      }));
    } else if (data?.keywords && Array.isArray(data.keywords)) {
      items = data.keywords.slice(0, Math.min(count, 10)).map((item: any, idx: number) => ({
        rank: idx + 1,
        keyword: item.keyword || item.name || item.title || String(item),
      }));
    }

    return items;
  } catch {
    return [];
  }
}