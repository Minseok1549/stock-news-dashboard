const fs = require('node:fs/promises')
const path = require('node:path')
const { XMLParser } = require('fast-xml-parser')

const ROOT = path.resolve(__dirname, '..')
const CONFIG_PATH = path.join(ROOT, 'public', 'config.json')
const NEWS_PATH = path.join(ROOT, 'public', 'data', 'news.json')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

function asArray(value) {
  if (!value) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function textValue(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    return value['#text'] || value._
  }
  return String(value)
}

function normalizeUrl(link) {
  const value = textValue(link)
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)
    const target = url.searchParams.get('url')
    return target || value
  } catch {
    return value
  }
}

function parseItems(xml, fallbackSource) {
  const parsed = parser.parse(xml)
  const items = asArray(parsed?.rss?.channel?.item)

  return items
    .map((item) => {
      const date = new Date(textValue(item.pubDate) || textValue(item.published))
      if (Number.isNaN(date.getTime())) {
        return null
      }

      return {
        title: textValue(item.title),
        url: normalizeUrl(item.link),
        source: textValue(item.source) || fallbackSource,
        publishedAt: date.toISOString(),
      }
    })
    .filter((article) => article && article.title && article.url)
}

async function fetchRss(url, fallbackSource) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'stock-news-dashboard/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return parseItems(await response.text(), fallbackSource)
}

function buildFeeds(ticker) {
  const encodedSymbol = encodeURIComponent(ticker.symbol)

  if (ticker.market === 'US') {
    return [
      {
        source: 'Yahoo Finance',
        url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodedSymbol}&region=US&lang=en-US`,
      },
      {
        source: 'Google News',
        url: `https://news.google.com/rss/search?q=${encodedSymbol}+stock&hl=en&gl=US`,
      },
    ]
  }

  const query = `${ticker.symbol} ${ticker.name} 주식`
  return [
    {
      source: 'Google News',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR`,
    },
  ]
}

function uniqueLatest(articles) {
  const seen = new Set()
  return articles
    .filter((article) => {
      if (seen.has(article.url)) {
        return false
      }
      seen.add(article.url)
      return true
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10)
}

async function fetchTicker(ticker) {
  const articles = []

  for (const feed of buildFeeds(ticker)) {
    try {
      articles.push(...(await fetchRss(feed.url, feed.source)))
    } catch (err) {
      console.error(`[${ticker.symbol}] ${feed.source} fetch failed:`, err.message)
    }
  }

  return uniqueLatest(articles)
}

async function main() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'))
  const output = {
    generatedAt: new Date().toISOString(),
    articles: {},
  }

  for (const ticker of config.tickers) {
    try {
      output.articles[ticker.symbol] = await fetchTicker(ticker)
    } catch (err) {
      console.error(`[${ticker.symbol}] ticker fetch failed:`, err.message)
      output.articles[ticker.symbol] = []
    }
  }

  await fs.mkdir(path.dirname(NEWS_PATH), { recursive: true })
  await fs.writeFile(NEWS_PATH, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${NEWS_PATH}`)
}

main().catch((err) => {
  console.error('Unexpected fetch-news failure:', err)
  process.exitCode = 1
})
