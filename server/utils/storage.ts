import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, resolve, sep } from 'node:path'

export const uploadDir = () => resolve(process.env.UPLOAD_DIR || './data/uploads')
export const maxUploadBytes = () => Number(process.env.MAX_UPLOAD_MB || 15) * 1024 * 1024
export const maxPhotosPerRecord = () => Number(process.env.MAX_PHOTOS_PER_RECORD || 12)

/** 通过文件头判断格式，不信任客户端声明的 MIME 或文件名 */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii')
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return { mime: 'image/heic', ext: 'heic' }
  }
  return null
}

export async function saveImage(buf: Buffer, ext: string) {
  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  // 服务端生成安全文件名，不使用客户端文件名
  const storedName = `${randomUUID()}.${ext}`
  await writeFile(join(dir, storedName), buf, { flag: 'wx' })
  return { storedName, sha256: createHash('sha256').update(buf).digest('hex') }
}

export function openStored(storedName: string) {
  const dir = uploadDir()
  const full = resolve(dir, storedName)
  if (!full.startsWith(dir + sep)) throw createError({ statusCode: 400, statusMessage: '非法路径' })
  return createReadStream(full)
}

export async function removeStored(storedName: string) {
  const dir = uploadDir()
  const full = resolve(dir, storedName)
  if (!full.startsWith(dir + sep)) return
  await unlink(full).catch(() => {})
}
