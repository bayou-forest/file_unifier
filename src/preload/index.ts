import { contextBridge, ipcRenderer } from 'electron'
import type { FileInfo, ScanProgress, DeleteResult, FlattenResult, DateSortResult, ThumbnailResult, CopyUniqueResult } from '@shared/types'

/**
 * レンダラープロセスに公開するAPI
 * contextBridge経由で安全にElectron APIを提供する
 */
const api = {
  /** フォルダ選択ダイアログを開く */
  selectFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-folder')
  },

  /** フォルダをスキャンし、全ファイルのメタデータを取得する */
  scanFolder: (folderPath: string, folderLabel: string): Promise<{ files: FileInfo[]; aborted: boolean }> => {
    return ipcRenderer.invoke('scan-folder', folderPath, folderLabel)
  },

  /** スキャンを中断する */
  abortScan: (): Promise<void> => {
    return ipcRenderer.invoke('abort-scan')
  },

  /** 指定ファイルを削除する */
  deleteFiles: (filePaths: string[]): Promise<DeleteResult> => {
    return ipcRenderer.invoke('delete-files', filePaths)
  },

  /** フォルダのフラット化を実行する */
  flattenFolder: (folderPath: string): Promise<FlattenResult> => {
    return ipcRenderer.invoke('flatten-folder', folderPath)
  },

  /** 空フォルダを再帰的に削除する */
  removeEmptyFolders: (folderPath: string): Promise<number> => {
    return ipcRenderer.invoke('remove-empty-folders', folderPath)
  },

  /** 日付別ファイル分類を実行する */
  dateSortFiles: (folderPath: string): Promise<DateSortResult> => {
    return ipcRenderer.invoke('date-sort-files', folderPath)
  },

  /** サムネイルを取得する */
  getThumbnail: (filePath: string): Promise<ThumbnailResult> => {
    return ipcRenderer.invoke('get-thumbnail', filePath)
  },

  /** メディアファイル判定 */
  isMediaFile: (filePath: string): Promise<{ isImage: boolean; isVideo: boolean }> => {
    return ipcRenderer.invoke('is-media-file', filePath)
  },

  /** ユニークファイルを相手フォルダにコピー */
  copyUniqueFiles: (
    sourceFiles: { filePath: string; fileName: string }[],
    destFolder: string,
    subFolderName: string
  ): Promise<CopyUniqueResult> => {
    return ipcRenderer.invoke('copy-unique-files', sourceFiles, destFolder, subFolderName)
  },

  /** スキャン進捗のコールバックを登録する (解除関数を返す) */
  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: ScanProgress
    ): void => {
      callback(progress)
    }
    ipcRenderer.on('scan-progress', handler)
    return () => {
      ipcRenderer.removeListener('scan-progress', handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
