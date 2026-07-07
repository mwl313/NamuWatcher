// ===== MCP Response Types =====

export interface McpResponse {
  content: McpContent[];
  isError?: boolean;
}

export interface McpContent {
  type: "text";
  text: string;
}

export function mcpOk(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export function mcpError(message: string): McpResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ type: "error", message }) }],
    isError: true,
  };
}

// ===== Trending =====

export interface TrendingKeyword {
  rank: number;
  keyword: string;
  category: string;
  views: number;
  likes: number;
  comments: number;
  postId: number;
}

export interface TrendingResponse {
  type: "trending";
  captured_at: string;
  total: number;
  keywords: TrendingKeyword[];
  source: string;
}

// ===== Why =====

export interface WhyResponse {
  type: "why";
  keyword: string;
  category: string;
  reason: string;
  source: "arca" | "namuwiki";
  source_url: string;
  posted_at: string;
  views: number;
  likes: number;
  note?: string;
}

// ===== Search =====

export interface SearchResponse {
  type: "search";
  title: string;
  summary: string;
  url: string;
}

// ===== History =====

export interface HistoryKeyword {
  rank: number;
  keyword: string;
  views: number;
  likes: number;
  category: string;
}

export interface HistoryAppearance {
  captured_at: string;
  rank: number;
  views: number;
}

export interface HistoryByDateResponse {
  type: "history";
  date: string;
  keywords: HistoryKeyword[];
}

export interface HistoryByKeywordResponse {
  type: "history";
  keyword: string;
  appearances: HistoryAppearance[];
}

export type HistoryResponse = HistoryByDateResponse | HistoryByKeywordResponse;

// ===== Velocity =====

export interface VelocityKeyword {
  keyword: string;
  growth_rate: number;
  current_views: number;
  previous_views: number;
  category: string;
}

export interface VelocityResponse {
  type: "velocity";
  analysis_hours: number;
  keywords: VelocityKeyword[];
}

// ===== Related =====

export interface RelatedItem {
  keyword: string;
  co_occurrence: number;
  category: string;
}

export interface RelatedResponse {
  type: "related";
  keyword: string;
  related: RelatedItem[];
}

// ===== Trending Together =====

export interface TrendingTogetherPair {
  keywords: [string, string];
  frequency: number;
  categories: [string, string];
}

export interface TrendingTogetherResponse {
  type: "trending_together";
  analysis_hours: number;
  pairs: TrendingTogetherPair[];
}

// ===== Trend of Day =====

export interface TopCategory {
  category: string;
  count: number;
}

export interface TopKeyword {
  keyword: string;
  rank: number;
}

export interface TrendOfDaySummary {
  total_keywords_tracked: number;
  top_categories: TopCategory[];
  top_keywords: TopKeyword[];
  fastest_risers: TrendingKeyword[];
}

export interface TrendOfDayResponse {
  type: "trend_of_day";
  date: string;
  summary: TrendOfDaySummary;
}

// ===== DB Row Types =====

export interface SnapshotRow {
  id?: number;
  captured_at: string;
  rank: number;
  keyword: string;
  category: string;
  views: number;
  likes: number;
  comments: number;
  post_id: number;
}

export interface ArticleRow {
  post_id: number;
  keyword: string;
  category: string;
  body: string;
  views: number;
  likes: number;
  comments: number;
  posted_at: string;
  fetched_at: string;
}

// ===== Scraper Types =====

export interface ArcaListItem {
  postId: number;
  keyword: string;
  category: string;
  views: number;
  likes: number;
  comments: number;
}

export interface ArcaArticle {
  postId: number;
  keyword: string;
  category: string;
  body: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
}

export interface NamuWikiResult {
  title: string;
  summary: string;
  url: string;
  chunks: string[];
}