import { useState, useEffect, useRef } from 'react'

/** メディアファイルの拡張子セット (レンダラー側判定用) */
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif', '.avif'
])
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'
])

function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.')
  if (idx === -1) return ''
  return filePath.slice(idx).toLowerCase()
}

export function isMediaFilePath(filePath: string): boolean {
  const ext = getExtension(filePath)
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
}

function isVideoPath(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filePath))
}

interface Props {
  filePath: string
  /** 表示するテキスト */
  displayText: string
  className?: string
}

/**
 * ファイルパスをクリック可能にし、メディアファイルの場合はサムネイルをポップオーバー表示する
 */
export default function ThumbnailPreview({ filePath, displayText, className }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isMedia = isMediaFilePath(filePath)
  const isVideo = isVideoPath(filePath)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (showPreview && !thumbnailUrl && !loading) {
      setLoading(true)
      window.electronAPI.getThumbnail(filePath).then((result) => {
        setThumbnailUrl(result.dataUrl)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [showPreview, filePath, thumbnailUrl, loading])

  // クリック外で閉じる
  useEffect(() => {
    if (!showPreview) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPreview(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPreview])

  // スクロール時にポップオーバーを閉じる
  useEffect(() => {
    if (!showPreview) return
    const handler = () => setShowPreview(false)
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [showPreview])

  // ポップオーバーの位置をビューポート基準で計算
  useEffect(() => {
    if (!showPreview || !popoverRef.current || !triggerRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const popover = popoverRef.current
    const popoverRect = popover.getBoundingClientRect()

    let top = trigger.bottom + 4
    let left = trigger.left

    // 下にはみ出す場合は上に表示
    if (top + popoverRect.height > window.innerHeight - 8) {
      top = trigger.top - popoverRect.height - 4
    }
    if (top < 8) top = 8
    // 右にはみ出す場合
    if (left + popoverRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popoverRect.width - 8
    }
    if (left < 8) left = 8

    popover.style.top = `${top}px`
    popover.style.left = `${left}px`
    popover.style.visibility = 'visible'
  }, [showPreview, thumbnailUrl, loading])

  const handleClick = (e: React.MouseEvent) => {
    if (!isMedia) return
    e.stopPropagation()
    setShowPreview(!showPreview)
  }

  return (
    <span className={`thumbnail-wrapper ${className || ''}`}>
      <span
        ref={triggerRef}
        className={`file-path-text ${isMedia ? 'clickable-media' : ''}`}
        onClick={handleClick}
        title={filePath}
      >
        {isMedia && <span className="media-icon">{isVideo ? '🎬' : '🖼️'}</span>}
        {displayText}
      </span>

      {showPreview && (
        <div className="thumbnail-popover" ref={popoverRef}>
          {loading && <div className="thumbnail-loading">読み込み中...</div>}
          {!loading && thumbnailUrl && !isVideo && (
            <img
              src={thumbnailUrl}
              alt="preview"
              className="thumbnail-image"
            />
          )}
          {!loading && isVideo && thumbnailUrl && (
            <video
              src={thumbnailUrl}
              className="thumbnail-video"
              controls
              muted
              autoPlay
              loop
              preload="metadata"
            />
          )}
          {!loading && !thumbnailUrl && (
            <div className="thumbnail-unavailable">プレビューを表示できません</div>
          )}
        </div>
      )}
    </span>
  )
}
