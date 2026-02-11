import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, nativeImage } from 'electron'
import type { DeleteResult, FlattenResult, DateSortResult, ThumbnailResult, ScanProgress, CopyUniqueResult } from '@shared/types'

/** 画像拡張子 */
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif', '.avif'
])

/** 動画拡張子 */
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'
])

/**
 * 指定されたファイルパスのリストを削除する
 */
export async function deleteFiles(filePaths: string[]): Promise<DeleteResult> {
  const deleted: string[] = []
  const failed: { path: string; error: string }[] = []

  for (const filePath of filePaths) {
    try {
      await fs.promises.unlink(filePath)
      deleted.push(filePath)
    } catch (err: any) {
      failed.push({ path: filePath, error: err.message })
    }
  }

  return { deleted, failed }
}

/**
 * フォルダのフラット化: サブフォルダ内のファイルをルートフォルダ直下に移動する
 * ファイル名が重複して移動できない場合はスキップし、失敗リストに追加する
 */
export async function flattenFolder(folderPath: string): Promise<FlattenResult> {
  const failedFiles: string[] = []
  let movedCount = 0

  const allFiles = await collectAllFiles(folderPath)

  for (const filePath of allFiles) {
    // 既にルートフォルダ直下にあるファイルはスキップ
    if (path.dirname(filePath) === folderPath) continue

    const targetPath = path.join(folderPath, path.basename(filePath))

    if (await fileExists(targetPath)) {
      // 同名ファイルが既に存在するため移動不可
      failedFiles.push(filePath)
    } else {
      try {
        await fs.promises.rename(filePath, targetPath)
        movedCount++
      } catch {
        // rename失敗 (異なるデバイス間等の場合)
        try {
          await fs.promises.copyFile(filePath, targetPath)
          await fs.promises.unlink(filePath)
          movedCount++
        } catch {
          failedFiles.push(filePath)
        }
      }
    }
  }

  return { movedCount, failedFiles }
}

/**
 * 指定フォルダ配下の空フォルダを再帰的にすべて削除する
 * 返り値は削除したフォルダ数
 */
export async function removeEmptyFolders(folderPath: string): Promise<number> {
  let removedCount = 0

  async function processDir(dirPath: string): Promise<boolean> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return false
    }

    let isEmpty = true

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const wasRemoved = await processDir(fullPath)
        if (!wasRemoved) isEmpty = false
      } else {
        isEmpty = false
      }
    }

    // ルートフォルダ自体は削除しない
    if (isEmpty && dirPath !== folderPath) {
      try {
        await fs.promises.rmdir(dirPath)
        removedCount++
        return true
      } catch {
        return false
      }
    }

    return isEmpty
  }

  await processDir(folderPath)
  return removedCount
}

/**
 * ディレクトリを再帰的に走査し、全ファイルのパスを収集する
 */
async function collectAllFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await collectAllFiles(fullPath)))
      } else if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  } catch {
    // 読み取り不可ディレクトリはスキップ
  }
  return results
}

/**
 * ファイルの存在チェック
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 日付別ファイル分類:
 * 対象フォルダを再帰的に探索し、各ファイルの更新日時(mtime)に基づいて
 * ルートフォルダ直下に yyyyMMdd_ 形式のフォルダを作り移動する。
 * 同名ファイルが移動先に存在する場合はスキップする。
 * (date_picture_sorting_py3.py と同等の動作)
 */
export async function dateSortFiles(folderPath: string): Promise<DateSortResult> {
  const allFiles = await collectAllFiles(folderPath)
  let movedCount = 0
  const skippedFiles: string[] = []
  const mainWindow = BrowserWindow.getAllWindows()[0]
  const total = allFiles.length

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i]
    const fileName = path.basename(filePath)

    try {
      // ファイルの更新日時を取得
      const stats = await fs.promises.stat(filePath)
      const mtime = stats.mtime

      // yyyyMMdd_ 形式のフォルダ名を生成
      const year = mtime.getFullYear().toString()
      const month = (mtime.getMonth() + 1).toString().padStart(2, '0')
      const day = mtime.getDate().toString().padStart(2, '0')
      const dateFolderName = `${year}${month}${day}_`

      // 移動先ディレクトリ: ルートフォルダ直下に yyyyMMdd_
      const newDirPath = path.join(folderPath, dateFolderName)

      // フォルダ作成
      if (!(await fileExists(newDirPath))) {
        await fs.promises.mkdir(newDirPath, { recursive: true })
      }

      // 移動先ファイルパス
      const targetPath = path.join(newDirPath, fileName)

      // 既に移動先にファイルがある場合、または既に正しいフォルダにいる場合はスキップ
      if (path.dirname(filePath) === newDirPath) {
        // 既に正しいフォルダにいる
      } else if (await fileExists(targetPath)) {
        skippedFiles.push(filePath)
      } else {
        try {
          await fs.promises.rename(filePath, targetPath)
          movedCount++
        } catch {
          // rename失敗 (異なるデバイス間等)
          try {
            await fs.promises.copyFile(filePath, targetPath)
            await fs.promises.unlink(filePath)
            movedCount++
          } catch {
            skippedFiles.push(filePath)
          }
        }
      }
    } catch {
      skippedFiles.push(filePath)
    }

    // 進捗通知
    if (mainWindow && !mainWindow.isDestroyed()) {
      const progress: ScanProgress = {
        current: i + 1,
        total,
        currentFile: fileName
      }
      mainWindow.webContents.send('scan-progress', progress)
    }
  }

  return { movedCount, totalCount: total, skippedFiles }
}

/**
 * 指定ファイルがメディアファイル(画像/動画)かどうか判定する
 */
export function isMediaFile(filePath: string): { isImage: boolean; isVideo: boolean } {
  const ext = path.extname(filePath).toLowerCase()
  return {
    isImage: IMAGE_EXTENSIONS.has(ext),
    isVideo: VIDEO_EXTENSIONS.has(ext)
  }
}

/**
 * ファイルのサムネイルを生成する
 * 画像: nativeImageで縮小して返す
 * 動画: 最初のフレーム抽出は困難なのでアイコン表示用にnullを返し、フロント側で対応
 */
export async function getThumbnail(filePath: string): Promise<ThumbnailResult> {
  const ext = path.extname(filePath).toLowerCase()

  if (IMAGE_EXTENSIONS.has(ext)) {
    try {
      // nativeImageで読み込んでリサイズ
      const img = nativeImage.createFromPath(filePath)
      if (img.isEmpty()) {
        return { dataUrl: null }
      }
      const resized = img.resize({ width: 200, quality: 'good' })
      return { dataUrl: resized.toDataURL() }
    } catch {
      return { dataUrl: null }
    }
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    // 動画のサムネイル: ネイティブサポートなし。file:// URLをレンダラー側でvideoタグ使用
    return { dataUrl: `file:///${filePath.replace(/\\/g, '/')}` }
  }

  return { dataUrl: null }
}

/**
 * ユニークファイルを相手フォルダにコピーする
 * sourceFiles: コピー元のファイル一覧（片方のフォルダにしかないファイル）
 * destFolder: コピー先の親フォルダ
 * subFolderName: コピー先に作成するサブフォルダ名 (例: '_extraA', '_extraB')
 */
export async function copyUniqueFiles(
  sourceFiles: { filePath: string; fileName: string }[],
  destFolder: string,
  subFolderName: string
): Promise<CopyUniqueResult> {
  const destDir = path.join(destFolder, subFolderName)
  const skippedFiles: string[] = []
  let copiedCount = 0

  // コピー先フォルダを作成
  await fs.promises.mkdir(destDir, { recursive: true })

  // コピー元ファイル群の中で同名ファイルがないかチェックするためのセット
  const usedNames = new Set<string>()

  // コピー先に既存のファイル名を取得
  try {
    const existingEntries = await fs.promises.readdir(destDir)
    for (const entry of existingEntries) {
      usedNames.add(entry.toLowerCase())
    }
  } catch {
    // ディレクトリが新規の場合は無視
  }

  // 進捗送信
  const mainWindow = BrowserWindow.getAllWindows()[0]
  const total = sourceFiles.length

  for (let i = 0; i < sourceFiles.length; i++) {
    const file = sourceFiles[i]
    const normalizedName = file.fileName.toLowerCase()

    // 進捗通知
    if (mainWindow) {
      mainWindow.webContents.send('scan-progress', {
        current: i + 1,
        total,
        currentFile: file.fileName
      } satisfies ScanProgress)
    }

    // 同名ファイルが既に存在する場合はスキップ
    if (usedNames.has(normalizedName)) {
      skippedFiles.push(file.filePath)
      continue
    }

    const destPath = path.join(destDir, file.fileName)
    try {
      await fs.promises.copyFile(file.filePath, destPath, fs.constants.COPYFILE_EXCL)
      usedNames.add(normalizedName)
      copiedCount++
    } catch {
      skippedFiles.push(file.filePath)
    }
  }

  return {
    copiedCount,
    totalCount: sourceFiles.length,
    skippedFiles
  }
}
