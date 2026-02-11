import { useState, useEffect } from 'react'
import type { DateSortResult, ScanProgress } from '@shared/types'

export default function DateSortTool() {
  const [folderPath, setFolderPath] = useState('')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [result, setResult] = useState<DateSortResult | null>(null)

  useEffect(() => {
    const cleanup = window.electronAPI.onScanProgress((prog) => {
      setProgress(prog)
    })
    return cleanup
  }, [])

  const selectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderPath(path)
      setResult(null)
    }
  }

  const handleDateSort = async () => {
    if (!folderPath) return
    const confirmed = confirm(
      `「${folderPath}」内のファイルを更新日時ごとのフォルダ(yyyyMMdd_)に分類します。\nよろしいですか？`
    )
    if (!confirmed) return

    setProcessing(true)
    setProgress(null)
    try {
      const res = await window.electronAPI.dateSortFiles(folderPath)
      setResult(res)
    } catch (err) {
      console.error('DateSort error:', err)
      alert('日付分類中にエラーが発生しました')
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  return (
    <div className="flatten-tool">
      <h2>📅 日付別ファイル分類</h2>
      <p className="tool-description">
        選択したフォルダを再帰的に探索し、各ファイルの更新日時に基づいて
        ルートフォルダ直下に <code>yyyyMMdd_</code> 形式のフォルダを作成し、
        ファイルを移動します。移動先に同名ファイルが既に存在する場合はスキップします。
      </p>

      <div className="folder-selector">
        <label>対象フォルダ:</label>
        <div className="folder-input-group">
          <input
            type="text"
            value={folderPath}
            readOnly
            placeholder="フォルダを選択してください..."
          />
          <button onClick={selectFolder} disabled={processing}>
            参照...
          </button>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={handleDateSort}
        disabled={!folderPath || processing}
      >
        {processing ? '処理中...' : '日付分類を実行'}
      </button>

      {processing && progress && (
        <div className="progress-section" style={{ marginTop: 12 }}>
          <div className="progress-label">
            処理中... ({progress.current}/{progress.total})
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

      {result && (
        <div className="flatten-result">
          <div className="result-summary">
            <span className="success-text">
              {result.movedCount}件のファイルを移動しました（全{result.totalCount}件）
            </span>
          </div>
          {result.skippedFiles.length > 0 && (
            <div className="failed-files">
              <h4>
                スキップされたファイル ({result.skippedFiles.length}件):
              </h4>
              <ul>
                {result.skippedFiles.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
