import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { SettingsModal } from './components/SettingsModal'

function App() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <Dashboard onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}

export default App
