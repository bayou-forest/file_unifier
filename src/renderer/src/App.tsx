import { useState } from 'react'
import DuplicateFinder from './components/DuplicateFinder'
import FlattenTool from './components/FlattenTool'
import EmptyFolderCleaner from './components/EmptyFolderCleaner'
import DateSortTool from './components/DateSortTool'

type TabId = 'duplicates' | 'flatten' | 'empty' | 'datesort'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('duplicates')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'duplicates', label: '重複ファイル検索' },
    { id: 'flatten', label: 'フラット化' },
    { id: 'empty', label: '空フォルダ削除' },
    { id: 'datesort', label: '日付分類' }
  ]

  return (
    <div className="app">
      <header className="app-header">
        <h1>📁 File Unifier</h1>
        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">
        {activeTab === 'duplicates' && <DuplicateFinder />}
        {activeTab === 'flatten' && <FlattenTool />}
        {activeTab === 'empty' && <EmptyFolderCleaner />}
        {activeTab === 'datesort' && <DateSortTool />}
      </main>
    </div>
  )
}

export default App
