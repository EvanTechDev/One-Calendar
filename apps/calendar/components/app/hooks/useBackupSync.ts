'use client'

import { useEffect, useState } from 'react'

export function useBackupSync() {
  const [backupEnabled, setBackupEnabled] = useState(false)
  const [backupSyncStatus, setBackupSyncStatus] = useState<
    'uploading' | 'failed' | 'done' | null
  >(null)

  useEffect(() => {
    const refreshBackupState = () => {
      const enabled = localStorage.getItem('auto-backup-enabled') === 'true'
      setBackupEnabled(enabled)
      if (!enabled) {
        setBackupSyncStatus(null)
        return
      }

      const status = localStorage.getItem('auto-backup-sync-status')
      if (status === 'uploading' || status === 'failed' || status === 'done') {
        setBackupSyncStatus(status)
      } else {
        setBackupSyncStatus('done')
      }
    }

    refreshBackupState()
    window.addEventListener('backup-status-change', refreshBackupState)
    window.addEventListener('storage', refreshBackupState)
    return () => {
      window.removeEventListener('backup-status-change', refreshBackupState)
      window.removeEventListener('storage', refreshBackupState)
    }
  }, [])

  return {
    backupEnabled,
    setBackupEnabled,
    backupSyncStatus,
    setBackupSyncStatus,
  }
}
