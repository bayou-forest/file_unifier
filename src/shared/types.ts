/**
 * アプリケーション全体で共有される型定義
 */

/** スキャンされたファイルの情報 */
export interface FileInfo {
  /** ファイルの絶対パス */
  filePath: string
  /** ファイル名のみ */
  fileName: string
  /** ルートフォルダからの相対パス */
  relativePath: string
  /** MD5ハッシュ値 */
  md5Hash: string
  /** ファイルサイズ (bytes) */
  size: number
  /** どのフォルダに属するか ('A' or 'B') */
  folderLabel: string
}

/** 重複ファイルのグループ */
export interface DuplicateGroup {
  /** グループのキー (ハッシュ値 or ファイル名) */
  key: string
  /** グループに含まれるファイル一覧 */
  files: FileInfo[]
}

/** スキャン進捗 */
export interface ScanProgress {
  /** 処理済みファイル数 */
  current: number
  /** 総ファイル数 */
  total: number
  /** 現在処理中のファイル名 */
  currentFile: string
}

/** ファイル削除結果 */
export interface DeleteResult {
  /** 削除に成功したファイルパス一覧 */
  deleted: string[]
  /** 削除に失敗したファイル一覧 */
  failed: { path: string; error: string }[]
}

/** フラット化結果 */
export interface FlattenResult {
  /** 移動に成功したファイル数 */
  movedCount: number
  /** 移動に失敗したファイルパス一覧 */
  failedFiles: string[]
}

/** 日付分類結果 */
export interface DateSortResult {
  /** 移動に成功したファイル数 */
  movedCount: number
  /** 全ファイル数 */
  totalCount: number
  /** スキップされたファイルパス一覧 (同名ファイルが既に存在) */
  skippedFiles: string[]
}

/** ユニークファイルコピー結果 */
export interface CopyUniqueResult {
  /** コピーに成功したファイル数 */
  copiedCount: number
  /** 対象ファイル総数 */
  totalCount: number
  /** スキップされたファイルパス一覧 (同名ファイルが既に存在) */
  skippedFiles: string[]
}

/** サムネイル結果 */
export interface ThumbnailResult {
  /** Base64エンコードされた画像データ (data URI) */
  dataUrl: string | null
}
