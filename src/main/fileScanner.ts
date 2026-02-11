import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { BrowserWindow } from 'electron'
import type { FileInfo, ScanProgress } from '@shared/types'

/** MD5ハッシュのキャッシュ (アプリ再起動でクリア) */
const hashCache = new Map<string, { hash: string; mtimeMs: number; size: number }>()

/** スキャン中断フラグ */
let scanAborted = false

/**
 * スキャンを中断する
 */
export function abortScan(): void {
  scanAborted = true
}

/**
 * 指定フォルダを再帰的にスキャンし、全ファイルのメタデータとMD5ハッシュを取得する
 * キャッシュが存在するファイルはMD5計算をスキップして高速化する
 */
export async function scanFolder(
  folderPath: string,
  folderLabel: string
): Promise<{ files: FileInfo[]; aborted: boolean }> {
  scanAborted = false

  // まず全ファイルパスを収集
  const filePaths = await collectFiles(folderPath)
  const total = filePaths.length
  const results: FileInfo[] = []
  const mainWindow = BrowserWindow.getAllWindows()[0]

  for (let i = 0; i < filePaths.length; i++) {
    // 中断チェック
    if (scanAborted) {
      return { files: results, aborted: true }
    }

    const filePath = filePaths[i]

    try {
      const stats = await fs.promises.stat(filePath)

      // キャッシュヒット判定 (パス + 更新日時 + サイズが一致)
      let hash: string
      const cached = hashCache.get(filePath)
      if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
        hash = cached.hash
      } else {
        hash = await computeMD5(filePath)
        hashCache.set(filePath, { hash, mtimeMs: stats.mtimeMs, size: stats.size })
      }

      results.push({
        filePath,
        fileName: path.basename(filePath),
        relativePath: path.relative(folderPath, filePath),
        md5Hash: hash,
        size: stats.size,
        folderLabel
      })
    } catch (err) {
      // 読み取り不可ファイルはスキップ
      console.error(`Error scanning ${filePath}:`, err)
    }

    // 進捗通知をレンダラーに送信
    if (mainWindow && !mainWindow.isDestroyed()) {
      const progress: ScanProgress = {
        current: i + 1,
        total,
        currentFile: path.basename(filePath)
      }
      mainWindow.webContents.send('scan-progress', progress)
    }
  }

  return { files: results, aborted: false }
}

/**
 * ディレクトリを再帰的に走査し、全ファイルのパスを収集する
 */
async function collectFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const subFiles = await collectFiles(fullPath)
        results.push(...subFiles)
      } else if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err)
  }

  return results
}

/**
 * ファイルのMD5ハッシュを計算する (ストリーム方式)
 */
function computeMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
