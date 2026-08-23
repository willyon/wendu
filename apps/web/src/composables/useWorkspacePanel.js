import { ref } from 'vue'

/** 窄屏工作台页内 Tab：资料库 / 问答（宽屏始终左右同屏，忽略此项） */
const panel = ref('library')

export function useWorkspacePanel() {
  function setPanel(next) {
    panel.value = next === 'ask' ? 'ask' : 'library'
  }

  return { panel, setPanel }
}
