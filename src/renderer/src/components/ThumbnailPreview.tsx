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

  const handleClick = (e: React.MouseEvent) => {
    if (!isMedia) return
    e.stopPropagation()
    setShowPreview(!showPreview)
  }

  return (
    <span className={`thumbnail-wrapper ${className || ''}`}>
      <span
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
