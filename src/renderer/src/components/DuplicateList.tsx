import { useState } from 'react'
import type { DuplicateGroup } from '@shared/types'
import ResolveDialog from './ResolveDialog'
import ThumbnailPreview from './ThumbnailPreview'

interface Props {
  groups: DuplicateGroup[]
  isCross: boolean
  onDeleteFiles: (filePaths: string[]) => Promise<void>
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export default function DuplicateList({ groups, isCross, onDeleteFiles }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (groups.length === 0) {
    return <div className="no-duplicates">重複ファイルはありません</div>
  }

  const toggleGroup = (index: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleFile = (filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  /** フォルダA側 or B側 を一括選択 */
  const selectFolderSide = (label: string) => {
    const paths = new Set<string>()
    for (const group of groups) {
      for (const file of group.files) {
        if (file.folderLabel === label) {
          paths.add(file.filePath)
        }
      }
    }
    setSelectedFiles(paths)
  }

  /** 各グループの先頭以外を一括選択 */
  const selectAllButFirst = () => {
    const paths = new Set<string>()
    for (const group of groups) {
      for (let i = 1; i < group.files.length; i++) {
        paths.add(group.files[i].filePath)
      }
    }
    setSelectedFiles(paths)
  }

  /** すべてを展開/折りたたみ */
  const toggleExpandAll = () => {
    if (expandedGroups.size === groups.length) {
      setExpandedGroups(new Set())
    } else {
      setExpandedGroups(new Set(groups.map((_, i) => i)))
    }
  }

  /** 選択されたファイルを削除 */
  const handleDelete = async () => {
    if (selectedFiles.size === 0) return
    const confirmed = confirm(
      `${selectedFiles.size}件のファイルを削除しますか？\nこの操作は取り消せません。`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await onDeleteFiles(Array.from(selectedFiles))
      setSelectedFiles(new Set())
    } finally {
      setDeleting(false)
    }
  }

  /** 1つずつ確認ダイアログの完了ハンドラ */
  const handleResolveComplete = async (filesToDelete: string[]) => {
    setShowResolveDialog(false)
    if (filesToDelete.length > 0) {
      const confirmed = confirm(
        `${filesToDelete.length}件のファイルを削除しますか？\nこの操作は取り消せません。`
      )
      if (!confirmed) return

      setDeleting(true)
      try {
        await onDeleteFiles(filesToDelete)
      } finally {
        setDeleting(false)
      }
    }
  }

  return (
    <div className="duplicate-list">
      <div className="duplicate-actions">
        {isCross ? (
          <>
            <button onClick={() => selectFolderSide('A')} className="btn-secondary">
              フォルダA側を全選択
            </button>
            <button onClick={() => selectFolderSide('B')} className="btn-secondary">
              フォルダB側を全選択
            </button>
          </>
        ) : (
          <button onClick={selectAllButFirst} className="btn-secondary">
            各グループの先頭以外を全選択
          </button>
        )}
        <button
          onClick={handleDelete}
          className="btn-danger"
          disabled={selectedFiles.size === 0 || deleting}
        >
          {deleting ? '削除中...' : `選択を削除 (${selectedFiles.size}件)`}
        </button>
        <button
          onClick={() => setShowResolveDialog(true)}
          className="btn-secondary"
        >
          1つずつ確認
        </button>
        <button onClick={toggleExpandAll} className="btn-secondary">
          {expandedGroups.size === groups.length ? 'すべて折りたたむ' : 'すべて展開'}
        </button>
      </div>

      <div className="duplicate-groups">
        {groups.map((group, idx) => (
          <div key={`${group.key}-${idx}`} className="duplicate-group">
            <div className="group-header" onClick={() => toggleGroup(idx)}>
              <span className="expand-icon">
                {expandedGroups.has(idx) ? '▼' : '▶'}
              </span>
              <span className="group-key">{group.key}</span>
              <span className="group-count">{group.files.length} ファイル</span>
              <span className="group-size">
                {formatSize(group.files.reduce((sum, f) => sum + f.size, 0))}
              </span>
            </div>
            {expandedGroups.has(idx) && (
              <div className="group-files">
                {group.files.map((file, fIdx) => (
                  <div key={fIdx} className="file-row">
                    <label className="file-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.filePath)}
                        onChange={() => toggleFile(file.filePath)}
                      />
                    </label>
                    <span className="file-folder-label">[{file.folderLabel}]</span>
                    <ThumbnailPreview
                      filePath={file.filePath}
                      displayText={file.relativePath}
                      className="file-path"
                    />
                    <span className="file-size">{formatSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showResolveDialog && (
        <ResolveDialog
          groups={groups}
          onComplete={handleResolveComplete}
          onCancel={() => setShowResolveDialog(false)}
        />
      )}
    </div>
  )
}
