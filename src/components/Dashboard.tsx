import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import type { NewsData } from '../types'
import { getStoredSettings } from './SettingsModal'
import { NewsCard } from './NewsCard'
import { TickerManager } from './TickerManager'

interface DashboardProps {
  onOpenSettings: () => void
}

const EMPTY_NEWS: NewsData = { generatedAt: '', articles: {} }
const NEWS_PATH = `${import.meta.env.BASE_URL}data/news.json`

function formatDate(value: string) {
  if (!value) {
    return '아직 없음'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '알 수 없음'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function Dashboard({ onOpenSettings }: DashboardProps) {
  const { config, triggerRefresh } = useConfig()
  const [news, setNews] = useState<NewsData>(EMPTY_NEWS)
  const [activeSymbol, setActiveSymbol] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch(`${NEWS_PATH}?v=${Date.now()}`)
      if (!response.ok) {
        throw new Error(`뉴스 로드 실패: ${response.status}`)
      }
      setNews((await response.json()) as NewsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '뉴스 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNews()
    const id = window.setInterval(() => void fetchNews(), 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [fetchNews])

  const tickers = useMemo(() => config?.tickers ?? [], [config])

  useEffect(() => {
    if (!activeSymbol && tickers.length > 0) {
      setActiveSymbol(tickers[0].symbol)
    }
  }, [activeSymbol, tickers])

  const activeTicker = tickers.find((ticker) => ticker.symbol === activeSymbol) ?? tickers[0]
  const articles = activeTicker ? news.articles[activeTicker.symbol] ?? [] : []

  const handleManualRefresh = async () => {
    const settings = getStoredSettings()
    if (!settings) {
      onOpenSettings()
      return
    }

    setRefreshing(true)
    setError(null)
    try {
      await triggerRefresh(settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : '워크플로우 실행 실패')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Stock News Dashboard</p>
          <h1>주식 뉴스</h1>
        </div>
        <div className="topbar-actions">
          <span className="updated-at">마지막 업데이트 {formatDate(news.generatedAt)}</span>
          <button type="button" onClick={() => void handleManualRefresh()} disabled={refreshing}>
            {refreshing ? '요청 중' : '지금 수집'}
          </button>
          <button className="icon-button" type="button" onClick={onOpenSettings} aria-label="설정">
            ⚙
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <TickerManager />

        <section className="news-panel">
          <div className="tabs" role="tablist" aria-label="종목">
            {tickers.map((ticker) => (
              <button
                key={ticker.symbol}
                type="button"
                className={ticker.symbol === activeTicker?.symbol ? 'tab active' : 'tab'}
                onClick={() => setActiveSymbol(ticker.symbol)}
              >
                <strong>{ticker.symbol}</strong>
                <span>{ticker.name}</span>
              </button>
            ))}
          </div>

          {loading && <p className="state-text">뉴스를 불러오는 중입니다.</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && !error && !activeTicker && <p className="state-text">등록된 종목이 없습니다.</p>}
          {!loading && !error && activeTicker && articles.length === 0 && (
            <p className="state-text">표시할 뉴스가 없습니다.</p>
          )}

          <div className="news-list">
            {articles.map((article) => (
              <NewsCard key={article.url} article={article} />
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
