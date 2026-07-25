import type { FileInfo, DuplicateGroup } from '@shared/types'

/**
 * 単一フォルダ内でMD5ハッシュが重複しているファイルをグループ化する
 */
export function findDuplicatesByHash(files: FileInfo[]): DuplicateGroup[] {
  const groups = new Map<string, FileInfo[]>()
  for (const file of files) {
    const existing = groups.get(file.md5Hash) || []
    existing.push(file)
    groups.set(file.md5Hash, existing)
  }
  return Array.from(groups.entries())
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({ key, files }))
}

/**
 * 単一フォルダ内でファイル名が重複しているファイルをグループ化する
 */
export function findDuplicatesByName(files: FileInfo[]): DuplicateGroup[] {
  const groups = new Map<string, FileInfo[]>()
  for (const file of files) {
    const existing = groups.get(file.fileName) || []
    existing.push(file)
    groups.set(file.fileName, existing)
  }
  return Array.from(groups.entries())
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({ key, files }))
}

/**
 * 単一フォルダ内でファイル名かつMD5ハッシュの両方が重複しているファイルをグループ化する
 */
export function findDuplicatesByNameAndHash(files: FileInfo[]): DuplicateGroup[] {
  const groups = new Map<string, FileInfo[]>()
  for (const file of files) {
    const key = `${file.fileName}::${file.md5Hash}`
    const existing = groups.get(key) || []
    existing.push(file)
    groups.set(key, existing)
  }
  return Array.from(groups.entries())
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({ key, files }))
}

/**
 * 2つのフォルダ間でファイル名かつMD5ハッシュの両方が重複しているファイルをグループ化する
 */
export function findCrossDuplicatesByNameAndHash(
  filesA: FileInfo[],
  filesB: FileInfo[]
): DuplicateGroup[] {
  const keysA = new Set(filesA.map((f) => `${f.fileName}::${f.md5Hash}`))
  const keysB = new Set(filesB.map((f) => `${f.fileName}::${f.md5Hash}`))
  const commonKeys = [...keysA].filter((k) => keysB.has(k))

  return commonKeys.map((key) => ({
    key,
    files: [
      ...filesA.filter((f) => `${f.fileName}::${f.md5Hash}` === key),
      ...filesB.filter((f) => `${f.fileName}::${f.md5Hash}` === key)
    ]
  }))
}

/**
 * 2つのフォルダ間でMD5ハッシュが重複しているファイルをグループ化する
 */
export function findCrossDuplicatesByHash(
  filesA: FileInfo[],
  filesB: FileInfo[]
): DuplicateGroup[] {
  const hashesA = new Set(filesA.map((f) => f.md5Hash))
  const hashesB = new Set(filesB.map((f) => f.md5Hash))
  const commonHashes = [...hashesA].filter((h) => hashesB.has(h))

  return commonHashes.map((hash) => ({
    key: hash,
    files: [
      ...filesA.filter((f) => f.md5Hash === hash),
      ...filesB.filter((f) => f.md5Hash === hash)
    ]
  }))
}

/**
 * 2つのフォルダ間でファイル名が重複しているファイルをグループ化する
 */
export function findCrossDuplicatesByName(
  filesA: FileInfo[],
  filesB: FileInfo[]
): DuplicateGroup[] {
  const namesA = new Set(filesA.map((f) => f.fileName))
  const namesB = new Set(filesB.map((f) => f.fileName))
  const commonNames = [...namesA].filter((n) => namesB.has(n))

  return commonNames.map((name) => ({
    key: name,
    files: [
      ...filesA.filter((f) => f.fileName === name),
      ...filesB.filter((f) => f.fileName === name)
    ]
  }))
}
