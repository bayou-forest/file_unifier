import { useState, useMemo, useEffect } from 'react'
import type { FileInfo, ScanProgress } from '@shared/types'
import {
  findDuplicatesByHash,
  findDuplicatesByName,
  findCrossDuplicatesByHash,
  findCrossDuplicatesByName
} from '../utils/duplicateFinder'
import DuplicateList from './DuplicateList'

const resultTabs = [
  { id: 'hash-a', label: 'Hash重複 (A内)' },
  { id: 'hash-b', label: 'Hash重複 (B内)' },
  { id: 'hash-cross', label: 'Hash重複 (A↔B)' },
  { id: 'name-a', label: '名前重複 (A内)' },
  { id: 'name-b', label: '名前重複 (B内)' },
  { id: 'name-cross', label: '名前重複 (A↔B)' }
]

export default function DuplicateFinder() {
  const [folderA, setFolderA] = useState('')
  const [folderB, setFolderB] = useState('')
  const [filesA, setFilesA] = useState<FileInfo[]>([])
  const [filesB, setFilesB] = useState<FileInfo[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanLabel, setScanLabel] = useState('')
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [activeResultTab, setActiveResultTab] = useState('hash-a')
  const [scanned, setScanned] = useState(false)
  const [abortedMessage, setAbortedMessage] = useState('')

  // スキャン進捗リスナー
  useEffect(() => {
    const cleanup = window.electronAPI.onScanProgress((prog) => {
      setProgress(prog)
    })
    return cleanup
  }, [])

  const selectFolderA = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderA(path)
      setScanned(false)
      setAbortedMessage('')
    }
  }

  const selectFolderB = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderB(path)
      setScanned(false)
      setAbortedMessage('')
    }
  }

  const handleAbortScan = async () => {
    await window.electronAPI.abortScan()
  }

  const startScan = async () => {
    if (!folderA && !folderB) return
    setScanning(true)
    setScanned(false)
    setProgress(null)
    setAbortedMessage('')

    // 既存のデータを保持（中断→再開時にキャッシュが効くようにするため、前回分はクリアしない）
    let newFilesA: FileInfo[] = []
    let newFilesB: FileInfo[] = []
    let wasAborted = false

    try {
      if (folderA) {
        setScanLabel('フォルダA')
        const result = await window.electronAPI.scanFolder(folderA, 'A')
        newFilesA = result.files
        if (result.aborted) {
          wasAborted = true
          setAbortedMessage(`フォルダAのスキャンが中断されました (${result.files.length}件処理済み)。キャッシュ済みのため再開は高速です。`)
        }
      }
      if (folderB && !wasAborted) {
        setScanLabel('フォルダB')
        const result = await window.electronAPI.scanFolder(folderB, 'B')
        newFilesB = result.files
        if (result.aborted) {
          wasAborted = true
          setAbortedMessage(`フォルダBのスキャンが中断されました (${result.files.length}件処理済み)。キャッシュ済みのため再開は高速です。`)
        }
      }

      setFilesA(newFilesA)
      setFilesB(newFilesB)
      if (!wasAborted) {
        setScanned(true)
      }
    } catch (err) {
      console.error('Scan error:', err)
      alert('スキャン中にエラーが発生しました')
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  // 各種重複検出 (メモ化)
  const hashDupsA = useMemo(() => findDuplicatesByHash(filesA), [filesA])
  const hashDupsB = useMemo(() => findDuplicatesByHash(filesB), [filesB])
  const hashDupsCross = useMemo(
    () =>
      filesA.length > 0 && filesB.length > 0
        ? findCrossDuplicatesByHash(filesA, filesB)
        : [],
    [filesA, filesB]
  )
  const nameDupsA = useMemo(() => findDuplicatesByName(filesA), [filesA])
  const nameDupsB = useMemo(() => findDuplicatesByName(filesB), [filesB])
  const nameDupsCross = useMemo(
    () =>
      filesA.length > 0 && filesB.length > 0
        ? findCrossDuplicatesByName(filesA, filesB)
        : [],
    [filesA, filesB]
  )

  const duplicateCounts: Record<string, number> = {
    'hash-a': hashDupsA.length,
    'hash-b': hashDupsB.length,
    'hash-cross': hashDupsCross.length,
    'name-a': nameDupsA.length,
    'name-b': nameDupsB.length,
    'name-cross': nameDupsCross.length
  }

  const getActiveGroups = () => {
    switch (activeResultTab) {
      case 'hash-a':
        return hashDupsA
      case 'hash-b':
        return hashDupsB
      case 'hash-cross':
        return hashDupsCross
      case 'name-a':
        return nameDupsA
      case 'name-b':
        return nameDupsB
      case 'name-cross':
        return nameDupsCross
      default:
        return []
    }
  }

  const handleDeleteFiles = async (filePaths: string[]) => {
    const result = await window.electronAPI.deleteFiles(filePaths)
    if (result.failed.length > 0) {
      alert(
        `${result.deleted.length}件削除成功、${result.failed.length}件失敗しました\n\n失敗:\n${result.failed.map((f) => f.path).join('\n')}`
      )
    } else {
      alert(`${result.deleted.length}件のファイルを削除しました`)
    }
    // 削除されたファイルをステートから除去
    const deletedSet = new Set(result.deleted)
    setFilesA((prev) => prev.filter((f) => !deletedSet.has(f.filePath)))
    setFilesB((prev) => prev.filter((f) => !deletedSet.has(f.filePath)))
  }

  const isCross = activeResultTab.includes('cross')

  return (
    <div className="duplicate-finder">
      <div className="folder-selectors">
        <div className="folder-selector">
          <label>フォルダA:</label>
          <div className="folder-input-group">
            <input
              type="text"
              value={folderA}
              readOnly
              placeholder="フォルダAを選択してください..."
            />
            <button onClick={selectFolderA} disabled={scanning}>
              参照...
            </button>
          </div>
        </div>
        <div className="folder-selector">
          <label>フォルダB (任意):</label>
          <div className="folder-input-group">
            <input
              type="text"
              value={folderB}
              readOnly
              placeholder="フォルダBを選択してください..."
            />
            <button onClick={selectFolderB} disabled={scanning}>
              参照...
            </button>
          </div>
        </div>
      </div>

      <div className="scan-controls">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={startScan}
            disabled={scanning || (!folderA && !folderB)}
          >
            {scanning ? 'スキャン中...' : 'スキャン開始'}
          </button>
          {scanning && (
            <button
              className="btn-danger"
              onClick={handleAbortScan}
            >
              中断
            </button>
          )}
        </div>
        {scanning && progress && (
          <div className="progress-section">
            <div className="progress-label">
              {scanLabel} スキャン中... ({progress.current}/{progress.total})
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`
                }}
              />
            </div>
            <div className="progress-file">{progress.currentFile}</div>
          </div>
        )}
        {abortedMessage && (
          <div className="abort-message">{abortedMessage}</div>
        )}
      </div>

      {scanned && (
        <div className="scan-summary">
          <span>フォルダA: {filesA.length} ファイル</span>
          {filesB.length > 0 && (
            <span>フォルダB: {filesB.length} ファイル</span>
          )}
        </div>
      )}

      {scanned && (
        <div className="results-section">
          <div className="result-tabs">
            {resultTabs.map((tab) => (
              <button
                key={tab.id}
                className={`result-tab ${activeResultTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveResultTab(tab.id)}
              >
                {tab.label}
                <span className="badge">{duplicateCounts[tab.id]}</span>
              </button>
            ))}
          </div>

          <DuplicateList
            groups={getActiveGroups()}
            isCross={isCross}
            onDeleteFiles={handleDeleteFiles}
          />
        </div>
      )}
    </div>
  )
}
