/**
 * 浏览器侧上传辅助（短时签名 PUT 到同域 /api/storage），不属于 REST api 表。
 */

export async function sha256File(file) {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {object} credential
 * @param {File} file
 * @param {(percent: number) => void} [onProgress] 0–100，仅直传字节阶段
 */
export function directUpload(credential, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', credential.url)

    Object.entries(credential.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      const err = new Error('OBJECT_MISSING')
      err.code = 'OBJECT_MISSING'
      reject(err)
    })

    xhr.addEventListener('error', () => {
      const err = new Error('OBJECT_MISSING')
      err.code = 'OBJECT_MISSING'
      reject(err)
    })

    xhr.addEventListener('abort', () => {
      const err = new Error('OBJECT_MISSING')
      err.code = 'OBJECT_MISSING'
      reject(err)
    })

    xhr.send(file)
  })
}
