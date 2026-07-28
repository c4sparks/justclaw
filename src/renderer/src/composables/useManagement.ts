import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

type ModalPhase = 'confirm' | 'progress' | 'done' | 'error'

/**
 * Management composable — state machine for uninstall/reset/backup/restore flows.
 */
export function useManagement() {
  const { t } = useI18n()
  // ── Uninstall ──
  const uninstallModal = ref<ModalPhase | null>(null)
  const uninstallMsg = ref('')
  const uninstallError = ref('')
  const uninstallOc = ref(false)

  // ── Reset ──
  const resetModal = ref<ModalPhase | null>(null)
  const resetMsg = ref('')
  const resetError = ref('')

  // ── Backup ──
  const backupModal = ref<ModalPhase | null>(null)
  const backupMsg = ref('')

  // ── Restore ──
  const restoreModal = ref<ModalPhase | null>(null)
  const restoreMsg = ref('')

  // Subscribe to uninstall progress
  const unsubProgress = window.electronAPI.uninstall.onProgress((msg: string) => {
    uninstallMsg.value = msg
  })
  onUnmounted(unsubProgress)

  // ── Uninstall actions ──
  function openUninstall(): void {
    uninstallModal.value = 'confirm'
    uninstallOc.value = false
  }
  function closeUninstall(): void { uninstallModal.value = null }

  async function executeUninstall(): Promise<void> {
    uninstallModal.value = 'progress'
    uninstallMsg.value = t('management.uninstall.preparing')

    if (uninstallOc.value) {
      uninstallMsg.value = t('management.uninstall.removing')
      const r = await window.electronAPI.uninstall.openclaw({ removeConfig: true })
      if (!r.success) {
        uninstallModal.value = 'error'
        uninstallError.value = r.error || 'OpenClaw 卸载失败'
        return
      }
    }

    uninstallModal.value = 'done'
    uninstallMsg.value = t('management.uninstall.done')
  }

  // ── Reset actions ──
  function openReset(): void { resetModal.value = 'confirm' }
  function closeReset(): void { resetModal.value = null }

  async function executeReset(): Promise<void> {
    resetModal.value = 'progress'
    resetMsg.value = t('management.reset.preparing')
    const r = await window.electronAPI.config.reset()
    if (r.success) {
      resetModal.value = 'done'
      resetMsg.value = t('management.reset.completed')
    } else {
      resetModal.value = 'error'
      resetError.value = r.error || t('management.reset.errorFallback')
    }
  }

  // ── Backup actions ──
  function closeBackup(): void { backupModal.value = null }

  async function executeBackup(): Promise<void> {
    backupModal.value = 'progress'
    backupMsg.value = t('management.backupRestore.backupProgress')
    const r = await window.electronAPI.backup.export()
    if (r.success) {
      backupModal.value = 'done'
      backupMsg.value = t('management.backupRestore.backupDone')
    } else if (r.error === 'CANCELLED') {
      backupModal.value = null
    } else {
      backupModal.value = 'error'
      backupMsg.value = r.error || t('management.backupRestore.backupError')
    }
  }

  // ── Restore actions ──
  function openRestore(): void { restoreModal.value = 'confirm' }
  function closeRestore(): void { restoreModal.value = null }

  async function executeRestore(): Promise<void> {
    restoreModal.value = 'progress'
    restoreMsg.value = t('management.backupRestore.restoreProgress')
    const r = await window.electronAPI.backup.import()
    if (r.success) {
      restoreModal.value = 'done'
      restoreMsg.value = t('management.backupRestore.restoreDone')
    } else if (r.error === 'CANCELLED') {
      restoreModal.value = null
    } else {
      restoreModal.value = 'error'
      restoreMsg.value = r.error || t('management.backupRestore.restoreError')
    }
  }

  return {
    // Uninstall
    uninstallModal, uninstallMsg, uninstallError,
    uninstallOc,
    openUninstall, closeUninstall, executeUninstall,
    // Reset
    resetModal, resetMsg, resetError,
    openReset, closeReset, executeReset,
    // Backup
    backupModal, backupMsg,
    closeBackup, executeBackup,
    // Restore
    restoreModal, restoreMsg,
    openRestore, closeRestore, executeRestore
  }
}
