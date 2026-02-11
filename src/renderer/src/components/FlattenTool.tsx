import { useState } from 'react'
import type { FlattenResult } from '@shared/types'

export default function FlattenTool() {
  const [folderPath, setFolderPath] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<FlattenResult | null>(null)

  const selectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderPath(path)
      setResult(null)
    }
  }

  const handleFlatten = async () => {
    if (!folderPath) return
    const confirmed = confirm(
      `「${folderPath}」内のすべてのサブフォルダのファイルをルート直下に移動します。\nよろしいですか？`
    )
    if (!confirmed) return

    setProcessing(true)
    try {
      const res = await window.electronAPI.flattenFolder(folderPath)
      setResult(res)
    } catch (err) {
      console.error('Flatten error:', err)
      alert('フラット化中にエラーが発生しました')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flatten-tool">
      <h2>📂 ファイルのフラット化</h2>
      <p className="tool-description">
        選択したフォルダ内のすべてのサブフォルダからファイルを取り出し、
        ルートフォルダ直下に移動します。ファイル名が重複して移動できない場合は
        元の場所に残し、移動できなかったファイルパスを表示します。
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
        onClick={handleFlatten}
        disabled={!folderPath || processing}
      >
        {processing ? '処理中...' : 'フラット化実行'}
      </button>

      {result && (
        <div className="flatten-result">
          <div className="result-summary">
            <span className="success-text">
              {result.movedCount}件のファイルを移動しました
            </span>
          </div>
          {result.failedFiles.length > 0 && (
            <div className="failed-files">
              <h4>
                移動できなかったファイル ({result.failedFiles.length}件):
              </h4>
              <ul>
                {result.failedFiles.map((f, i) => (
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
