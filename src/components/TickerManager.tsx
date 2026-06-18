import { useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import type { GitHubSettings, Ticker } from '../types'
import { getStoredSettings, SettingsModal } from './SettingsModal'

export function TickerManager() {
  const { config, loading, error, addTicker, removeTicker } = useConfig()
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [market, setMarket] = useState<Ticker['market']>('US')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const runWithSettings = async (action: (settings: GitHubSettings) => Promise<void>) => {
    const settings = getStoredSettings()
    if (!settings) {
      setShowSettings(true)
      return
    }

    setSaving(true)
    setActionError(null)
    try {
      await action(settings)
      setSymbol('')
      setName('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'GitHub 업데이트 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runWithSettings((settings) => addTicker({ symbol, name, market }, settings))
  }

  return (
    <section className="ticker-manager">
      <div className="section-title">
        <h2>종목 관리</h2>
        {loading && <span>불러오는 중</span>}
      </div>

      <form className="ticker-form" onSubmit={handleAdd}>
        <input
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          placeholder="Symbol"
          required
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          required
        />
        <select value={market} onChange={(event) => setMarket(event.target.value as Ticker['market'])}>
          <option value="US">US</option>
          <option value="KR">KR</option>
        </select>
        <button type="submit" disabled={saving}>
          추가
        </button>
      </form>

      {(error || actionError) && <p className="error-text">{actionError ?? error}</p>}

      <div className="ticker-list">
        {config?.tickers.map((ticker) => (
          <div className="ticker-row" key={ticker.symbol}>
            <div>
              <strong>{ticker.symbol}</strong>
              <span>{ticker.name}</span>
            </div>
            <span className="market-badge">{ticker.market}</span>
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={() => void runWithSettings((settings) => removeTicker(ticker.symbol, settings))}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </section>
  )
}
