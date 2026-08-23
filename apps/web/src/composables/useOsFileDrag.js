import { MIME } from './useAskScope'

/** OS 文件拖入（上传）；与列表行拖入提问框（application/x-wendu-file）区分 */
export function isOsFileDrag(event) {
  const dt = event.dataTransfer
  if (!dt?.types?.includes?.('Files')) return false
  if (dt.types.includes(MIME) && !dt.files?.length) return false
  return true
}
