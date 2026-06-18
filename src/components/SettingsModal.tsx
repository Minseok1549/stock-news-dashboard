import { useEffect, useState } from 'react'
import type { GitHubSettings } from '../types'

interface SettingsModalProps {
  onClose: () => void
}

const STORAGE_KEY = 'gh_settings'

export function getStoredSettings(): GitHubSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const settings = JSON.parse(raw) as GitHubSettings
    if (!settings.owner || !settings.repo || !settings.pat) {
      return null
    }
    return settings
  } catch {
    return null
  }
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [pat, setPat] = useState('')

  useEffect(() => {
    const settings = getStoredSettings()
    if (settings) {
      setOwner(settings.owner)
      setRepo(settings.repo)
      setPat(settings.pat)
    }
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner, repo, pat }))
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-title">GitHub 설정</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            x
          </button>
        </div>
        <form className="settings-form" onSubmit={handleSubmit}>
          <label>
            Owner
            <input value={owner} onChange={(event) => setOwner(event.target.value)} required />
          </label>
          <label>
            Repo
            <input value={repo} onChange={(event) => setRepo(event.target.value)} required />
          </label>
          <label>
            PAT
            <input
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              type="password"
              autoComplete="off"
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              취소
            </button>
            <button type="submit">저장</button>
          </div>
        </form>
      </section>
    </div>
  )
}
