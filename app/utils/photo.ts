/** 上传前缩小照片（长边 2200px，JPEG），节省手机流量与树莓派存储。无法解码（如部分 HEIC）时保留原文件。 */
export async function compressImage(file: File, maxSide = 2200, quality = 0.85): Promise<{ blob: Blob; name: string }> {
  const fallback = { blob: file as Blob, name: file.name || 'photo' }
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) && file.type) return fallback
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale); const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size > file.size * 1.2) return fallback
    return { blob, name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' }
  } catch {
    return fallback
  }
}
