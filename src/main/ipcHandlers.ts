import { ipcMain, dialog } from 'electron'
import { scanFolder, abortScan } from './fileScanner'
import { deleteFiles, flattenFolder, removeEmptyFolders, dateSortFiles, getThumbnail, isMediaFile, copyUniqueFiles } from './fileOperations'

/**
 * メインプロセスのIPCハンドラを登録する
 */
export function registerIpcHandlers(): void {
  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'フォルダを選択'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // フォルダスキャン (全ファイルのメタデータとMD5ハッシュ取得)
  ipcMain.handle(
    'scan-folder',
    async (_event, folderPath: string, folderLabel: string) => {
      return await scanFolder(folderPath, folderLabel)
    }
  )

  // スキャン中断
  ipcMain.handle('abort-scan', async () => {
    abortScan()
  })

  // ファイル削除
  ipcMain.handle('delete-files', async (_event, filePaths: string[]) => {
    return await deleteFiles(filePaths)
  })

  // フォルダのフラット化
  ipcMain.handle('flatten-folder', async (_event, folderPath: string) => {
    return await flattenFolder(folderPath)
  })

  // 空フォルダの削除
  ipcMain.handle('remove-empty-folders', async (_event, folderPath: string) => {
    return await removeEmptyFolders(folderPath)
  })

  // 日付別ファイル分類
  ipcMain.handle('date-sort-files', async (_event, folderPath: string) => {
    return await dateSortFiles(folderPath)
  })

  // サムネイル取得
  ipcMain.handle('get-thumbnail', async (_event, filePath: string) => {
    return await getThumbnail(filePath)
  })

  // メディアファイル判定
  ipcMain.handle('is-media-file', async (_event, filePath: string) => {
    return isMediaFile(filePath)
  })

  // ユニークファイルを相手フォルダにコピー
  ipcMain.handle(
    'copy-unique-files',
    async (
      _event,
      sourceFiles: { filePath: string; fileName: string }[],
      destFolder: string,
      subFolderName: string
    ) => {
      return await copyUniqueFiles(sourceFiles, destFolder, subFolderName)
    }
  )
}
