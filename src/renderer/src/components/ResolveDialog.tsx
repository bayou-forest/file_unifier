import { useState } from 'react'
import type { DuplicateGroup } from '@shared/types'
import ThumbnailPreview from './ThumbnailPreview'

interface Props {
  groups: DuplicateGroup[]
  onComplete: (filesToDelete: string[]) => void
  onCancel: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export default function ResolveDialog({ groups, onComplete, onCancel }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // 各グループで「残す」ファイルのセットを管理 (デフォルト: 先頭ファイルを残す)
  const [keepDecisions, setKeepDecisions] = useState<Map<number, Set<string>>>(() => {
    const initial = new Map<number, Set<string>>()
    groups.forEach((group, idx) => {
      initial.set(idx, new Set([group.files[0].filePath]))
    })
    return initial
  })

  const currentGroup = groups[currentIndex]
  const currentKeep = keepDecisions.get(currentIndex) || new Set()

  const toggleKeep = (filePath: string) => {
    setKeepDecisions((prev) => {
      const next = new Map(prev)
      const current = new Set(next.get(currentIndex) || [])
      if (current.has(filePath)) {
        // 少なくとも1つは残す必要がある
        if (current.size > 1) {
          current.delete(filePath)
        }
      } else {
        current.add(filePath)
      }
      next.set(currentIndex, current)
      return next
    })
  }

  const goNext = () => {
    if (currentIndex < groups.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  /** すべてのグループの決定を適用して、削除対象ファイル一覧を返す */
  const handleApply = () => {
    const filesToDelete: string[] = []
    groups.forEach((group, idx) => {
      const keep = keepDecisions.get(idx) || new Set()
      for (const file of group.files) {
        if (!keep.has(file.filePath)) {
          filesToDelete.push(file.filePath)
        }
      }
    })
    onComplete(filesToDelete)
  }

  /**
   * 「ここまで処理する」ボタン:
   * 先頭（index=0）から現在表示中のグループ（currentIndex）までの決定を適用し、
   * それ以降のグループは処理しない（元のまま残す）
   */
  const handleApplyUpToHere = () => {
    const filesToDelete: string[] = []
    for (let idx = 0; idx <= currentIndex; idx++) {
      const group = groups[idx]
      const keep = keepDecisions.get(idx) || new Set()
      for (const file of group.files) {
        if (!keep.has(file.filePath)) {
          filesToDelete.push(file.filePath)
        }
      }
    }
    onComplete(filesToDelete)
  }

  // 全グループでの削除予定総数を計算
  const totalDeleteCount = (() => {
    let count = 0
    groups.forEach((group, idx) => {
      const keep = keepDecisions.get(idx) || new Set()
      count += group.files.length - keep.size
    })
    return count
  })()

  // ここまでの削除予定数を計算
  const upToHereDeleteCount = (() => {
    let count = 0
    for (let idx = 0; idx <= currentIndex; idx++) {
      const group = groups[idx]
      const keep = keepDecisions.get(idx) || new Set()
      count += group.files.length - keep.size
    }
    return count
  })()

  return (
    <div className="modal-overlay">
      <div className="modal-content resolve-dialog">
        <div className="modal-header">
          <h3>
            重複ファイルの解決 ({currentIndex + 1}/{groups.length})
          </h3>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="resolve-instruction">
            残すファイルを選択してください。チェックされていないファイルは削除されます。
            （少なくとも1つは選択が必要です）
          </p>
          <div className="resolve-key">キー: {currentGroup.key}</div>

          <div className="resolve-files">
            {currentGroup.files.map((file, idx) => (
              <div
                key={idx}
                className={`resolve-file-row ${currentKeep.has(file.filePath) ? 'keep' : 'delete'}`}
                onClick={() => toggleKeep(file.filePath)}
              >
                <input
                  type="checkbox"
                  checked={currentKeep.has(file.filePath)}
                  onChange={() => toggleKeep(file.filePath)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="resolve-file-info">
                  <div className="resolve-file-path-row">
                    <ThumbnailPreview
                      filePath={file.filePath}
                      displayText={`[${file.folderLabel}] ${file.relativePath}`}
                      className="resolve-thumb-wrapper"
                    />
                  </div>
                  <div className="resolve-file-meta">
                    {file.filePath} · {formatSize(file.size)}
                  </div>
                </div>
                <span
                  className={`resolve-badge ${currentKeep.has(file.filePath) ? 'badge-keep' : 'badge-delete'}`}
                >
                  {currentKeep.has(file.filePath) ? '残す' : '削除'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <div className="nav-buttons">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="btn-secondary"
            >
              ◀ 前へ
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === groups.length - 1}
              className="btn-secondary"
            >
              次へ ▶
            </button>
          </div>
          <div className="action-buttons">
            <button onClick={onCancel} className="btn-secondary">
              キャンセル
            </button>
            <button onClick={handleApplyUpToHere} className="btn-warning">
              ここまで処理する（{upToHereDeleteCount}件削除）
            </button>
            <button onClick={handleApply} className="btn-primary">
              すべて適用（{totalDeleteCount}件削除）
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
