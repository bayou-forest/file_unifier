import { useState } from 'react'

export default function EmptyFolderCleaner() {
  const [folderPath, setFolderPath] = useState('')
  const [processing, setProcessing] = useState(false)
  const [removedCount, setRemovedCount] = useState<number | null>(null)

  const selectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderPath(path)
      setRemovedCount(null)
    }
  }

  const handleClean = async () => {
    if (!folderPath) return
    const confirmed = confirm(
      `「${folderPath}」内の空フォルダをすべて削除します。\nよろしいですか？`
    )
    if (!confirmed) return

    setProcessing(true)
    try {
      const count = await window.electronAPI.removeEmptyFolders(folderPath)
      setRemovedCount(count)
    } catch (err) {
      console.error('Clean error:', err)
      alert('空フォルダ削除中にエラーが発生しました')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="empty-cleaner">
      <h2>🗑️ 空フォルダの削除</h2>
      <p className="tool-description">
        選択したフォルダ内の空のサブフォルダを再帰的にすべて削除します。
        ルートフォルダ自体は削除されません。
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
        onClick={handleClean}
        disabled={!folderPath || processing}
      >
        {processing ? '処理中...' : '空フォルダを削除'}
      </button>

      {removedCount !== null && (
        <div className="clean-result">
          <span className="success-text">
            {removedCount}件の空フォルダを削除しました
          </span>
        </div>
      )}
    </div>
  )
}
