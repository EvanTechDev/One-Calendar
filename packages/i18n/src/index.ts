export const messages = {
  zh: {
    settingsTitle: "设置",
    dsMigrationTitle: "迁移数据服务器（DS）",
    dsMigrationHint: "迁移只在 Bluesky 登录后可用，且只传输密文数据。",
    dsCurrent: "当前 DS",
    dsInputPlaceholder: "https://new-ds.example.com",
    dsMigrateConfirm: "确认迁移",
    dsMigrating: "迁移中...",
    dsSuccess: "迁移成功，已切换到新的 DS。",
    dsError: "迁移失败，请检查新 DS 可用性或签名状态。"
  },
  en: {
    settingsTitle: "Settings",
    dsMigrationTitle: "Migrate Data Server (DS)",
    dsMigrationHint: "Migration is available only after Bluesky login and transfers ciphertext only.",
    dsCurrent: "Current DS",
    dsInputPlaceholder: "https://new-ds.example.com",
    dsMigrateConfirm: "Confirm Migration",
    dsMigrating: "Migrating...",
    dsSuccess: "Migration completed and switched to the new DS.",
    dsError: "Migration failed. Check DS availability or signature state."
  }
} as const;

export type Locale = keyof typeof messages;

export function t(locale: Locale = "zh") {
  return messages[locale] || messages.zh;
}
