export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

export function classifyCategory(title: string): string {
  const emojiCategoryMap: Record<string, string> = {
    "⚽️": "스포츠",
    "🎙️": "인방",
    "🤔": "일반",
    "📺": "TV",
    "⚖️": "정치",
    "🔎": "커뮤",
  };

  const textCategoryMap: Record<string, string> = {
    "스포츠": "스포츠",
    "인방": "인방",
    "일반": "일반",
    "TV": "TV",
    "정치": "정치",
    "커뮤": "커뮤",
  };

  for (const [emoji, category] of Object.entries(emojiCategoryMap)) {
    if (title.includes(emoji)) return category;
  }

  for (const [text, category] of Object.entries(textCategoryMap)) {
    if (title.includes(text)) return category;
  }

  return "기타";
}

export function cleanKeyword(title: string): string {
  const emojis = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  let cleaned = title.replace(emojis, "").trim();
  const categoryWords = ["스포츠", "인방", "일반", "TV", "정치", "커뮤"];
  for (const word of categoryWords) {
    cleaned = cleaned.replace(word, "").trim();
  }
  cleaned = cleaned.replace(/^[\[\](){}]+/g, "").trim();
  return cleaned;
}

export function extractPostIdFromUrl(url: string): number | null {
  const match = url.match(/\/b\/namuhotnow\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "ko-KR,ko;q=0.9";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Accept-Language": ACCEPT_LANGUAGE,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Referer": "https://www.google.com/",
  "Connection": "keep-alive",
  "DNT": "1",
  "Upgrade-Insecure-Requests": "1",
};

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 15_000,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        ...DEFAULT_HEADERS,
        ...extraHeaders,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithCookie(
  url: string,
  timeoutMs = 15_000,
  cookie?: string
): Promise<{ response: Response | null; cookie: string }> {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    const setCookie = response.headers.get("set-cookie") || "";
    const mergedCookie = cookie
      ? mergeCookies(cookie, setCookie)
      : setCookie;
    return { response, cookie: mergedCookie };
  } catch {
    return { response: null, cookie: cookie || "" };
  } finally {
    clearTimeout(timer);
  }
}

function mergeCookies(existing: string, newCookies: string): string {
  const map = new Map<string, string>();
  const all = existing + "; " + newCookies;
  all.split(";").forEach((pair) => {
    const eq = pair.indexOf("=");
    if (eq > 0) {
      const key = pair.slice(0, eq).trim();
      const val = pair.slice(eq + 1).split(";")[0].trim();
      if (key && val) map.set(key, val);
    }
  });
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}