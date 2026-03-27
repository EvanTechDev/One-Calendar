export const dsI18n = {
  en: {
    migrateTitle: "Data server migration",
    migrateDescription: "Securely move encrypted data to your new DS.",
    migrateTargetLabel: "New DS URL",
    migrateStart: "Start migration",
    migrateProgressIdle: "Idle",
    migrateProgressExport: "Exporting encrypted records",
    migrateProgressImport: "Importing into new DS",
    migrateProgressCleanup: "Cleaning up old DS",
    migrateProgressUpdate: "Updating DS pointer",
    migrateSuccess: "Migration completed",
    migrateFailed: "Migration failed"
  },
  "zh-CN": {
    migrateTitle: "数据服务器迁移",
    migrateDescription: "将密文数据安全迁移到新的 DS。",
    migrateTargetLabel: "新 DS 地址",
    migrateStart: "开始迁移",
    migrateProgressIdle: "空闲",
    migrateProgressExport: "正在导出密文数据",
    migrateProgressImport: "正在导入到新 DS",
    migrateProgressCleanup: "正在清理旧 DS",
    migrateProgressUpdate: "正在更新 DS 指针",
    migrateSuccess: "迁移完成",
    migrateFailed: "迁移失败"
  }
} as const;
