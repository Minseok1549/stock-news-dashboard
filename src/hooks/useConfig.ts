import { useCallback, useEffect, useState } from 'react'
import type { Config, GitHubSettings, Ticker } from '../types'

interface GitHubContentResponse {
  content: string
  sha: string
}

const CONFIG_PATH = 'public/config.json'

function publicPath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^public\//, '')}`
}

function decodeBase64Json<T>(content: string): T {
  const binary = atob(content.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

function encodeBase64Json(value: unknown): string {
  const json = `${JSON.stringify(value, null, 2)}\n`
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

async function githubRequest<T>(
  url: string,
  settings: GitHubSettings,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`GitHub API 오류 ${response.status}: ${message}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function getRemoteConfig(settings: GitHubSettings) {
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${CONFIG_PATH}`
  const file = await githubRequest<GitHubContentResponse>(url, settings)
  return {
    config: decodeBase64Json<Config>(file.content),
    sha: file.sha,
  }
}

async function putRemoteConfig(config: Config, sha: string, settings: GitHubSettings) {
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${CONFIG_PATH}`
  await githubRequest(url, settings, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'chore: update ticker config',
      content: encodeBase64Json(config),
      sha,
    }),
  })
}

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLocalConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${publicPath(CONFIG_PATH)}?v=${Date.now()}`)
      if (!response.ok) {
        throw new Error(`config.json 로드 실패: ${response.status}`)
      }
      setConfig((await response.json()) as Config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'config.json 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLocalConfig()
  }, [loadLocalConfig])

  const addTicker = useCallback(async (ticker: Ticker, settings: GitHubSettings) => {
    const { config: remoteConfig, sha } = await getRemoteConfig(settings)
    const normalizedSymbol = ticker.symbol.trim().toUpperCase()
    const nextConfig: Config = {
      tickers: [
        ...remoteConfig.tickers.filter((item) => item.symbol !== normalizedSymbol),
        { ...ticker, symbol: normalizedSymbol, name: ticker.name.trim() },
      ],
      lastUpdated: new Date().toISOString(),
    }
    await putRemoteConfig(nextConfig, sha, settings)
    setConfig(nextConfig)
  }, [])

  const removeTicker = useCallback(async (symbol: string, settings: GitHubSettings) => {
    const { config: remoteConfig, sha } = await getRemoteConfig(settings)
    const nextConfig: Config = {
      tickers: remoteConfig.tickers.filter((ticker) => ticker.symbol !== symbol),
      lastUpdated: new Date().toISOString(),
    }
    await putRemoteConfig(nextConfig, sha, settings)
    setConfig(nextConfig)
  }, [])

  const triggerRefresh = useCallback(async (settings: GitHubSettings) => {
    const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/workflows/fetch-news.yml/dispatches`
    await githubRequest<void>(url, settings, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    })
  }, [])

  return {
    config,
    loading,
    error,
    reload: loadLocalConfig,
    addTicker,
    removeTicker,
    triggerRefresh,
  }
}
