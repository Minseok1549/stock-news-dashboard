export interface Ticker {
  symbol: string
  name: string
  market: 'US' | 'KR'
}

export interface Article {
  title: string
  url: string
  source: string
  publishedAt: string
}

export interface NewsData {
  generatedAt: string
  articles: Record<string, Article[]>
}

export interface Config {
  tickers: Ticker[]
  lastUpdated: string
}

export interface GitHubSettings {
  owner: string
  repo: string
  pat: string
}
