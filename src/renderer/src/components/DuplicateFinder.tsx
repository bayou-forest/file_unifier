import { useState, useMemo, useEffect } from 'react'
import type { FileInfo, ScanProgress, CopyUniqueResult, CacheInfo } from '@shared/types'
import {
  findDuplicatesByHash,
  findDuplicatesByName,
  findDuplicatesByNameAndHash,
  findCrossDuplicatesByHash,
  findCrossDuplicatesByName,
  findCrossDuplicatesByNameAndHash
} from '../utils/duplicateFinder'
import DuplicateList from './DuplicateList'

const resultTabs = [
  { id: 'hash-a', label: 'Hash重複 (A内)' },
  { id: 'hash-b', label: 'Hash重複 (B内)' },
  { id: 'hash-cross', label: 'Hash重複 (A↔B)' },
  { id: 'name-a', label: '名前重複 (A内)' },
  { id: 'name-b', label: '名前重複 (B内)' },
  { id: 'name-cross', label: '名前重複 (A↔B)' },
  { id: 'both-a', label: '名前+Hash重複 (A内)' },
  { id: 'both-b', label: '名前+Hash重複 (B内)' },
  { id: 'both-cross', label: '名前+Hash重複 (A↔B)' }
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

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
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<CopyUniqueResult | null>(null)
  const [copyDirection, setCopyDirection] = useState<'AtoB' | 'BtoA' | null>(null)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [showCacheDetails, setShowCacheDetails] = useState(false)

  // スキャン進捗リスナー
  useEffect(() => {
    const cleanup = window.electronAPI.onScanProgress((prog) => {
      setProgress(prog)
    })
    return cleanup
  }, [])

  const refreshCacheInfo = async (): Promise<void> => {
    const info = await window.electronAPI.getCacheInfo()
    setCacheInfo(info)
  }

  // 初回表示時にキャッシュ件数を取得
  useEffect(() => {
    refreshCacheInfo()
  }, [])

  const toggleCacheDetails = async (): Promise<void> => {
    if (!showCacheDetails) {
      await refreshCacheInfo()
    }
    setShowCacheDetails((prev) => !prev)
  }

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
      refreshCacheInfo()
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
  const bothDupsA = useMemo(() => findDuplicatesByNameAndHash(filesA), [filesA])
  const bothDupsB = useMemo(() => findDuplicatesByNameAndHash(filesB), [filesB])
  const bothDupsCross = useMemo(
    () =>
      filesA.length > 0 && filesB.length > 0
        ? findCrossDuplicatesByNameAndHash(filesA, filesB)
        : [],
    [filesA, filesB]
  )

  // フォルダAにしかないファイル / Bにしかないファイル (ハッシュ基準)
  const uniqueToA = useMemo(() => {
    if (filesA.length === 0 || filesB.length === 0) return []
    const hashesB = new Set(filesB.map((f) => f.md5Hash))
    return filesA.filter((f) => !hashesB.has(f.md5Hash))
  }, [filesA, filesB])

  const uniqueToB = useMemo(() => {
    if (filesA.length === 0 || filesB.length === 0) return []
    const hashesA = new Set(filesA.map((f) => f.md5Hash))
    return filesB.filter((f) => !hashesA.has(f.md5Hash))
  }, [filesA, filesB])

  /** ユニークファイルを相手フォルダにコピー */
  const handleCopyUnique = async (direction: 'AtoB' | 'BtoA') => {
    const sourceFiles = direction === 'AtoB' ? uniqueToA : uniqueToB
    const destFolder = direction === 'AtoB' ? folderB : folderA
    const subFolderName = direction === 'AtoB' ? '_extraA' : '_extraB'

    if (sourceFiles.length === 0) {
      alert('コピー対象のファイルがありません。')
      return
    }
    if (!destFolder) {
      alert('コピー先のフォルダが選択されていません。')
      return
    }

    const confirmed = confirm(
      `${sourceFiles.length}件のファイルを\n${destFolder}/${subFolderName}\nにコピーしますか？`
    )
    if (!confirmed) return

    setCopying(true)
    setCopyResult(null)
    setCopyDirection(direction)
    try {
      const result = await window.electronAPI.copyUniqueFiles(
        sourceFiles.map((f) => ({ filePath: f.filePath, fileName: f.fileName })),
        destFolder,
        subFolderName
      )
      setCopyResult(result)
    } catch (err) {
      console.error('Copy error:', err)
      alert('コピー中にエラーが発生しました')
    } finally {
      setCopying(false)
      setProgress(null)
    }
  }

  const duplicateCounts: Record<string, number> = {
    'hash-a': hashDupsA.length,
    'hash-b': hashDupsB.length,
    'hash-cross': hashDupsCross.length,
    'name-a': nameDupsA.length,
    'name-b': nameDupsB.length,
    'name-cross': nameDupsCross.length,
    'both-a': bothDupsA.length,
    'both-b': bothDupsB.length,
    'both-cross': bothDupsCross.length
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
      case 'both-a':
        return bothDupsA
      case 'both-b':
        return bothDupsB
      case 'both-cross':
        return bothDupsCross
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

      <div className="cache-info-section">
        <div className="cache-info-summary">
          <span>ハッシュキャッシュ: {cacheInfo ? cacheInfo.count : 0} 件</span>
          <button
            className="btn-secondary"
            onClick={toggleCacheDetails}
            disabled={!cacheInfo || cacheInfo.count === 0}
          >
            {showCacheDetails ? '詳細を隠す' : '詳細を表示'}
          </button>
        </div>
        {showCacheDetails && cacheInfo && cacheInfo.count > 0 && (
          <div className="cache-info-details">
            <table className="cache-info-table">
              <thead>
                <tr>
                  <th>ファイルパス</th>
                  <th>サイズ</th>
                  <th>MD5</th>
                </tr>
              </thead>
              <tbody>
                {cacheInfo.entries.map((entry) => (
                  <tr key={entry.filePath}>
                    <td className="cache-path-cell" title={entry.filePath}>
                      {entry.filePath}
                    </td>
                    <td>{formatSize(entry.size)}</td>
                    <td className="cache-hash-cell">{entry.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {scanned && filesA.length > 0 && filesB.length > 0 && activeResultTab === 'hash-cross' && (
        <div className="unique-copy-section">
          <h3>ユニークファイルのコピー（ハッシュ基準）</h3>
          <p className="tool-description" style={{ marginBottom: 12 }}>
            片方のフォルダにしかないファイルを、もう片方のフォルダにコピーします。
            コピー先にサブフォルダが作成され、ファイルがフラットにコピーされます。
          </p>
          <div className="unique-copy-buttons">
            <button
              className="btn-primary"
              disabled={copying || uniqueToA.length === 0}
              onClick={() => handleCopyUnique('AtoB')}
            >
              {copying && copyDirection === 'AtoB'
                ? 'コピー中...'
                : `Aにしかないファイルを B/_extraA にコピー (${uniqueToA.length}件)`}
            </button>
            <button
              className="btn-primary"
              disabled={copying || uniqueToB.length === 0}
              onClick={() => handleCopyUnique('BtoA')}
            >
              {copying && copyDirection === 'BtoA'
                ? 'コピー中...'
                : `Bにしかないファイルを A/_extraB にコピー (${uniqueToB.length}件)`}
            </button>
          </div>
          {copying && progress && (
            <div className="progress-section" style={{ marginTop: 12 }}>
              <div className="progress-label">
                コピー中... ({progress.current}/{progress.total})
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="progress-file">{progress.currentFile}</div>
            </div>
          )}
          {copyResult && (
            <div className="copy-result">
              <div className="result-summary">
                <span className="success-text">
                  {copyResult.copiedCount}件コピー成功
                </span>
                {copyResult.skippedFiles.length > 0 && (
                  <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>
                    / {copyResult.skippedFiles.length}件スキップ
                  </span>
                )}
              </div>
              {copyResult.skippedFiles.length > 0 && (
                <div className="failed-files">
                  <h4>スキップされたファイル（同名ファイルが存在）:</h4>
                  <ul>
                    {copyResult.skippedFiles.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
