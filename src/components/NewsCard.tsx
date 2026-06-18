import type { Article } from '../types'

interface NewsCardProps {
  article: Article
}

function relativeTime(value: string) {
  const published = new Date(value).getTime()
  if (Number.isNaN(published)) {
    return '발행일 미상'
  }

  const diffMs = Date.now() - published
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) {
    return '방금 전'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}시간 전`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return `${diffDays}일 전`
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <a className="news-card" href={article.url} target="_blank" rel="noopener noreferrer">
      <h3>{article.title}</h3>
      {article.summary && <p className="news-summary">{article.summary}</p>}
      <div className="news-meta">
        <span>{article.source}</span>
        <span>{relativeTime(article.publishedAt)}</span>
      </div>
    </a>
  )
}
