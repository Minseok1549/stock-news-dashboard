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
        description: textValue(item.description) || '',
      }
    })
    .filter((article) => article && article.title && article.url)
}

async function summarizeArticle(title, description, apiKey) {
  const prompt = `다음 뉴스 기사를 한국어로 2~3문장으로 요약해주세요.\n\n제목: ${title}\n내용: ${description || title}`
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Gemini API ${response.status}: ${body}`)
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    console.log(`  → summary: ${text ? text.slice(0, 50) + '...' : 'null'}`)
    return text
  } catch (err) {
    console.error(`  → Gemini failed: ${err.message}`)
    return null
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readExistingNews() {
  try {
    return JSON.parse(await fs.readFile(NEWS_PATH, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { articles: {} }
    }
    throw err
  }
}

function buildExistingSummaryMap(news) {
  const summaries = new Map()

  for (const articles of Object.values(news.articles || {})) {
    for (const article of asArray(articles)) {
      if (article?.url && article.summary !== null) {
        summaries.set(article.url, article.summary)
      }
    }
  }

  return summaries
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
  const existingNews = await readExistingNews()
  const existingSummaries = buildExistingSummaryMap(existingNews)
  const apiKey = process.env.GOOGLE_AI_API_KEY
  console.log(`API key: ${apiKey ? '있음 (' + apiKey.slice(0, 6) + '...)' : '없음 — 요약 건너뜀'}`)
  const output = {
    generatedAt: new Date().toISOString(),
    articles: {},
  }

  for (const ticker of config.tickers) {
    try {
      const articles = await fetchTicker(ticker)
      output.articles[ticker.symbol] = []

      for (const article of articles) {
        let summary = null

        if (existingSummaries.has(article.url)) {
          summary = existingSummaries.get(article.url)
          console.log(`  [캐시] ${article.title.slice(0, 50)}`)
        } else if (apiKey) {
          console.log(`  [Gemini] ${article.title.slice(0, 50)}`)
          summary = await summarizeArticle(article.title, article.description, apiKey)
          await delay(4000)
        } else {
          console.log(`  [건너뜀] ${article.title.slice(0, 50)}`)
        }

        output.articles[ticker.symbol].push({
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          summary,
        })
      }
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
