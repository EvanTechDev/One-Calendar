"use client"

import { useEffect, useState } from "react"

export type Language = "en" | "zh"

export const translations = {
  en: {
    calendar: "Calendar",
    oneCalendar: "One Calendar",
    createEvent: "Create Event",
    myCalendars: "My Calendars",
    addNewCalendar: "Add New Calendar",
    day: "Day",
    week: "Week",
    month: "Month",
    analytics: "Analytics",
    searchEvents: "Search events",
    title: "Title",
    startTime: "Start Time",
    endTime: "End Time",
    endTimeError: "End time must be after start time",
    allDay: "All Day",
    location: "Location",
    participants: "Participants",
    participantsPlaceholder: "Enter email addresses separated by commas",
    description: "Description",
    color: "Color",
    notification: "Notification",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    update: "Update",
    minutesBefore: "{minutes} minutes before",
    hourBefore: "{hours} hour before",
    sunday: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    settings: "Settings",
    language: "Language",
    firstDayOfWeek: "First Day of Week",
    timezone: "Timezone",
    selectCalendar: "Select calendar",
    selectColor: "Select color",
    selectNotification: "Select notification time",
    atEventTime: "At event time",
    customTime: "Custom time",
    customTimeMinutes: "Minutes before event",
    eventAt: "Event at",
    view: "View",
    notificationSound: "Notification Sound",
    telegramSound: "Telegram",
    telegramSfxSound: "Telegram SFX",
    today: "Today",
    // Analytics translations
    timeAnalytics: "Time Analytics",
    timeAnalyticsDesc: "Analyze how you spend your time",
    timeDistribution: "Time Distribution",
    categoryTime: "Category Time (Hours)",
    totalEvents: "Total Events",
    mostProductiveDay: "Most Productive Day",
    mostProductiveHour: "Most Productive Hour",
    noData: "No data",
    week: "Week",
    month: "Month",
    year: "Year",
    thisWeek: "This Week",
    thisMonth: "This Month",
    thisYear: "This Year",
    createCategories: "Create Categories",
    categoryName: "Category Name",
    keywords: "Keywords",
    addKeyword: "Add Keyword",
    addCategory: "Add Category",
    existingCategories: "Existing Categories",
    importExport: "Import & Export",
    importCalendar: "Import Calendar",
    exportCalendar: "Export Calendar",
    fileImport: "File Import",
    urlImport: "URL Import",
    selectCalendarFile: "Select Calendar File",
    calendarUrl: "Calendar URL",
    supportedFormats: "Supported formats: .ics (iCalendar), .json and .csv",
    enterUrl: "Enter URL to .ics or .json file",
    debugMode: "Enable Debug Mode",
    debugInfo: "Debug Info",
    importing: "Importing...",
    import: "Import",
    exportFormat: "Export Format",
    dateRange: "Date Range",
    allEvents: "All Events",
    futureEvents: "Future Events",
    pastEvents: "Past Events",
    last30Days: "Last 30 Days",
    last90Days: "Last 90 Days",
    includeCompleted: "Include Completed Events",
    exporting: "Exporting...",
    export: "Export",
    importSuccess: "Successfully imported {count} events",
    exportSuccess: "Successfully exported {count} events",
    importWarning: "No events could be parsed from the file, please check the format",
    importError: "Error importing calendar data: {error}",
    exportError: "Error exporting calendar data",
    googleCalendarGuide: "Google Calendar Import Guide",
    googleCalendarGuideText:
      "When importing from Google Calendar, first select 'Settings > Import & Export > Export' in Google Calendar, download the .ics file and import it here. Do not use the 'Get Public URL' option as that is for sharing, not exporting.",
    iCalendarFormat: "iCalendar Format",
    backupData: "Backup Your Data",
    crossPlatformSync: "Cross-Platform Sync",
    iCalendarFormatDesc: "Standard format compatible with Google Calendar, Outlook, and Apple Calendar.",
    backupDataDesc: "Export your calendar data as a backup to ensure you don't lose important events.",
    crossPlatformSyncDesc:
      "Sync your calendar data across different devices and applications to maintain consistent scheduling.",
    importExportTips: "Import & Export Tips",
    tip1: "Exported iCalendar (.ics) files can be directly imported into most calendar applications",
    tip2: "CSV format is suitable for data exchange with spreadsheet applications",
    tip3: "JSON format contains the most complete event data, suitable for backup",
    tip4: "Importing a large number of events may take some time, please be patient",
    tip5: "Regularly exporting your calendar data as a backup is a good habit",
    dateAndTime: "Date and Time",
    copy: "Copy",
    eventDuplicated: "Event duplicated",
    welcomeToOneCalendar: "Welcome to One Calendar",
    powerfulCalendarApp:
      "This is a powerful calendar application that helps you manage your schedule and import/export calendar data.",
    basicFeatures: "Basic Features",
    importExportFeatures: "Import & Export",
    createEventGuide: "Create Event",
    createEventDesc:
      'Click the "Create Event" button at the top of the sidebar, or directly click on a time slot in the calendar to create a new event.',
    switchViewGuide: "Switch View",
    switchViewDesc:
      "Use the dropdown menu in the top navigation bar to switch between day, week, month, and analytics views.",
    manageCalendarCategoriesGuide: "Manage Calendar Categories",
    manageCalendarCategoriesDesc:
      'In the "My Calendars" section of the sidebar, you can add, edit, and delete different calendar categories.',
    setReminderGuide: "Set Reminders",
    setReminderDesc:
      "When creating or editing an event, you can set a reminder time, and the system will notify you before the event starts.",
    importExportGuide: "Import & Export Calendar Data",
    importExportDesc:
      "Exchange data with other calendar applications, import or export your calendar events in various formats.",
    mainFeatures: "Main features",
    importExportFeaturesList1: "Import events from iCalendar (.ics), JSON, and CSV files",
    importExportFeaturesList2: "Export your calendar data in different formats for backup or sharing",
    importExportFeaturesList3:
      "Sync with other calendar applications like Google Calendar, Outlook, and Apple Calendar",
    getStarted: "Get Started",
    nextStep: "Next",
    previousStep: "Previous",
    startUsing: "Start Using",
    hours: "hours",
    events: "events",
    uncategorized: "Uncategorized",
    loading: "Loading...",
    welcomeToAnalytics: "Welcome to Advanced Analytics",
    analyticsDescription: "We've added powerful features to help you better manage your time and schedule",
    unnamedEvent: "Unnamed Event",
    enableShortcuts: "Enable Keyboard Shortcuts",
    availableShortcuts: "Available Shortcuts",
    defaultView: "Default View",
    newEvent: "New Event",
    searchEvents: "Search Events",
    today: "Today",
    dayView: "Day View",
    weekView: "Week View",
    monthView: "Month View",
    nextPeriod: "Next Period",
    previousPeriod: "Previous Period",
    userProfile: "User Profile",
    backupData: "Backup Data",
    restoreData: "Restore Data",
    backupDescription: "Create a backup of your calendar data. You'll need this password to restore your data later.",
    restoreDescription: "Restore your calendar data from a previous backup. This will replace your current data.",
    password: "Password",
    confirmPassword: "Confirm Password",
    enterPassword: "Enter a password",
    confirmYourPassword: "Confirm your password",
    passwordRequirements:
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    passwordRequirementsHint:
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    passwordsDoNotMatch: "Passwords do not match",
    passwordRequired: "Password is required",
    backupSuccessful: "Backup Successful",
    dataBackedUpSuccessfully: "Your data has been backed up successfully.",
    backupFailed: "Backup Failed",
    restoreSuccessful: "Restore Successful",
    dataRestoredSuccessfully: "Your data has been restored successfully.",
    restoreFailed: "Restore Failed",
    backupNotFound: "Backup not found. Please check your password.",
    unknownError: "An unknown error occurred",
    cancel: "Cancel",
    backup: "Backup",
    restore: "Restore",
    processing: "Processing...",
    enterBackupPassword: "Enter your backup password",
    restoreWarning: "Warning: This will replace all your current data with the backup data.",
    replaceExistingData: "Replace existing data?",
    mergeData: "Merge with existing data",
    autoBackupTitle: "Enable Auto-Backup?",
    autoBackupDescription:
      "Would you like to automatically backup your data with this password whenever changes are made?",
    enableAutoBackup: "Enable Auto-Backup",
    autoBackupEnabled: "Auto-Backup Enabled",
    autoBackupDisabled: "Auto-Backup Disabled",
    logout: "Logout",
    share: "Share",
    shareEvent: "Share Event",
    nickname: "Nickname",
    enterNickname: "Enter your nickname",
    shareLink: "Share Link",
    copyLink: "Copy Link",
    linkCopied: "Link copied to clipboard",
    manageShares: "Manage Shares",
    deleteShare: "Delete Share",
    sharedBy: "Shared by",
    noShares: "No shared events",
    shareDeleted: "Share deleted successfully",
    bookmarks: "Bookmarks",
    bookmarked: "Bookmarked",
    bookmark: "Bookmark",
    unbookmark: "Remove Bookmark",
    bookmarkAdded: "Event bookmarked",
    bookmarkRemoved: "Bookmark Removed",
    noBookmarks: "You haven't bookmarked any events yet",
    searchBookmarks: "Search bookmarks...",
    noMatchingBookmarks: "No matching bookmarks found",
    manageBookmarks: "Manage Bookmarks",
    eventRemovedFromBookmarks: "Event has been removed from your bookmarks",
    tip: "Tip",
    dontShowAgain: "Don't show again",
    qrCode: "QR Code",
    downloadQRCode: "Download QR Code",
    qrCodeDownloaded: "QR Code Downloaded",
    savedToDevice: "Saved to your device",
    scanQRCodeToView: "Scan this QR code to view the event",
  },
  zh: {
    calendar: "日历",
    oneCalendar: "One Calendar",
    createEvent: "创建日程",
    myCalendars: "我的日历",
    addNewCalendar: "添加新日历",
    day: "日",
    week: "周",
    month: "月",
    analytics: "分析",
    searchEvents: "搜索日程",
    title: "标题",
    startTime: "开始时间",
    endTime: "结束时间",
    endTimeError: "结束时间必须晚于开始时间",
    allDay: "全天",
    location: "地点",
    participants: "参与者",
    participantsPlaceholder: "输入邮箱地址，用逗号分隔",
    description: "描述",
    color: "颜色",
    notification: "提醒",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    update: "更新",
    minutesBefore: "提前{minutes}分钟",
    hourBefore: "提前{hours}小时",
    sunday: "星期日",
    monday: "星期一",
    tuesday: "星期二",
    wednesday: "星期三",
    thursday: "星期四",
    friday: "星期五",
    saturday: "星期六",
    settings: "设置",
    language: "语言",
    firstDayOfWeek: "每周第一天",
    timezone: "时区",
    selectCalendar: "选择日历",
    selectColor: "选择颜色",
    selectNotification: "选择提醒时间",
    atEventTime: "事件开始时",
    customTime: "自定义时间",
    customTimeMinutes: "提前分钟数",
    eventAt: "事件时间",
    view: "查看",
    notificationSound: "通知声音",
    telegramSound: "Telegram",
    telegramSfxSound: "Telegram SFX",
    today: "今天",
    // Analytics translations
    timeAnalytics: "时间分析",
    timeAnalyticsDesc: "分析您如何利用时间",
    timeDistribution: "时间分布",
    categoryTime: "分类时间（小时）",
    totalEvents: "总事件数",
    mostProductiveDay: "最高效的一天",
    mostProductiveHour: "最高效的时段",
    noData: "无数据",
    week: "周",
    month: "月",
    year: "年",
    thisWeek: "本周",
    thisMonth: "本月",
    thisYear: "本年",
    createCategories: "创建分类",
    categoryName: "分类名称",
    keywords: "关键词",
    addKeyword: "添加关键词",
    addCategory: "添加分类",
    existingCategories: "现有分类",
    importExport: "导入与导出",
    importCalendar: "导入日历",
    exportCalendar: "导出日历",
    fileImport: "文件导入",
    urlImport: "URL导入",
    selectCalendarFile: "选择日历文件",
    calendarUrl: "日历URL",
    supportedFormats: "支持 .ics (iCalendar), .json 和 .csv 文件格式",
    enterUrl: "输入指向 .ics 或 .json 文件的URL",
    debugMode: "启用调试模式",
    debugInfo: "调试信息",
    importing: "导入中...",
    import: "导入",
    exportFormat: "导出格式",
    dateRange: "日期范围",
    allEvents: "所有事件",
    futureEvents: "未来事件",
    pastEvents: "过去事件",
    last30Days: "最近30天",
    last90Days: "最近90天",
    includeCompleted: "包含已完成的事件",
    exporting: "导出中...",
    export: "导出",
    importSuccess: "成功导入 {count} 个事件",
    exportSuccess: "成功导出 {count} 个事件",
    importWarning: "未能从文件中解析出任何事件，请检查文件格式是否正确",
    importError: "导入日历数据时出错: {error}",
    exportError: "导出日历数据时出错",
    googleCalendarGuide: "Google日历导入指南",
    googleCalendarGuideText:
      '从Google日历导入时，请先在Google日历中选择"设置 > 导入和导出 > 导出"，下载.ics文件后在此处导入。不要使用"获取公共URL"选项，因为那是用于共享而非导出的。',
    iCalendarFormat: "iCalendar格式",
    backupData: "备份您的数据",
    crossPlatformSync: "跨平台同步",
    iCalendarFormatDesc: "支持与Google日历、Outlook和Apple日历等应用程序兼容的标准格式。",
    backupDataDesc: "导出您的日历数据作为备份，确保不会丢失重要事件。",
    crossPlatformSyncDesc: "在不同设备和应用之间同步您的日历数据，保持一致的日程安排。",
    importExportTips: "导入导出提示",
    tip1: "导出的iCalendar (.ics) 文件可以直接导入到大多数日历应用中",
    tip2: "CSV格式适合与电子表格应用程序进行数据交换",
    tip3: "JSON格式包含最完整的事件数据，适合作为备份",
    tip4: "导入大量事件可能需要一些时间，请耐心等待",
    tip5: "定期导出您的日历数据作为备份是个好习惯",
    dateAndTime: "日期和时间",
    copy: "副本",
    eventDuplicated: "事件已复制",
    welcomeToOneCalendar: "欢迎使用One Calendar",
    powerfulCalendarApp: "这是一个功能强大的日历应用，帮助您管理日程并导入/导出日历数据。",
    basicFeatures: "基础功能",
    importExportFeatures: "导入与导出",
    createEventGuide: "创建事件",
    createEventDesc: '点击侧边栏顶部的"创建日程"按钮，或直接点击日历上的时间段来创建新事件。',
    switchViewGuide: "切换视图",
    switchViewDesc: "使用顶部导航栏的下拉菜单在日、周、月和分析视图之间切换。",
    manageCalendarCategoriesGuide: "管理日历分类",
    manageCalendarCategoriesDesc: '在侧边栏的"我的日历"部分，您可以添加、编辑和删除不同的日历分类。',
    setReminderGuide: "设置提醒",
    setReminderDesc: "创建或编辑事件时，您可以设置提醒时间，系统会在事件开始前通知您。",
    importExportGuide: "导入与导出日历数据",
    importExportDesc: "与其他日历应用交换数据，导入或导出各种格式的日历事件。",
    mainFeatures: "主要功能",
    importExportFeaturesList1: "从iCalendar (.ics)、JSON和CSV文件导入事件",
    importExportFeaturesList2: "以不同格式导出您的日历数据，用于备份或共享",
    importExportFeaturesList3: "与Google日历、Outlook和Apple日历等其他日历应用同步",
    getStarted: "开始使用",
    nextStep: "下一步",
    previousStep: "上一步",
    startUsing: "开始使用",
    hours: "小时",
    events: "事件",
    uncategorized: "未分类",
    loading: "加载中...",
    welcomeToAnalytics: "欢迎使用高级分析功能",
    analyticsDescription: "我们添加了强大的功能，帮助您更好地管理时间和日程",
    unnamedEvent: "未命名日程",
    enableShortcuts: "开启快捷键",
    availableShortcuts: "可用快捷键",
    defaultView: "默认视图",
    newEvent: "创建新事件",
    searchEvents: "搜索事件",
    today: "今天",
    dayView: "日视图",
    weekView: "周视图",
    monthView: "月视图",
    nextPeriod: "下个周期",
    previousPeriod: "上个周期",
    userProfile: "用户资料",
    backupData: "备份数据",
    restoreData: "恢复数据",
    backupDescription: "创建日历数据的备份。您需要此密码才能在以后恢复数据。",
    restoreDescription: "从之前的备份恢复日历数据。这将替换您当前的数据。",
    password: "密码",
    confirmPassword: "确认密码",
    enterPassword: "输入密码",
    confirmYourPassword: "确认您的密码",
    passwordRequirements: "密码必须至少 8 个字符，并且包含大写字母、小写字母、数字和特殊字符。",
    passwordRequirementsHint: "密码必须至少 8 个字符，并且包含大写字母、小写字母、数字和特殊字符。",
    passwordsDoNotMatch: "密码不匹配",
    passwordRequired: "需要密码",
    backupSuccessful: "备份成功",
    dataBackedUpSuccessfully: "您的数据已成功备份。",
    backupFailed: "备份失败",
    restoreSuccessful: "恢复成功",
    dataRestoredSuccessfully: "您的数据已成功恢复。",
    restoreFailed: "恢复失败",
    backupNotFound: "找不到备份。请检查您的密码。",
    unknownError: "发生未知错误",
    cancel: "取消",
    backup: "备份",
    restore: "恢复",
    processing: "处理中...",
    enterBackupPassword: "输入您的备份密码",
    restoreWarning: "警告：这会将您当前的所有数据替换为备份数据。",
    replaceExistingData: "替换现有数据？",
    mergeData: "与现有数据合并",
    autoBackupTitle: "启用自动备份？",
    autoBackupDescription: "您是否希望在每次进行更改时使用此密码自动备份您的数据？",
    enableAutoBackup: "启用自动备份",
    autoBackupEnabled: "自动备份已启用",
    autoBackupDisabled: "自动备份已禁用",
    logout: "登出",
    share: "分享",
    shareEvent: "分享事件",
    nickname: "昵称",
    enterNickname: "输入您的昵称",
    shareLink: "分享链接",
    copyLink: "复制链接",
    linkCopied: "链接已复制到剪贴板",
    manageShares: "管理分享",
    deleteShare: "删除分享",
    sharedBy: "分享者",
    noShares: "没有分享的事件",
    shareDeleted: "分享已成功删除",
    bookmarks: "收藏夹",
    bookmarked: "已收藏",
    bookmark: "收藏",
    unbookmark: "取消收藏",
    bookmarkAdded: "事件已收藏",
    bookmarkRemoved: "已移除收藏",
    noBookmarks: "您还没有收藏任何事件",
    searchBookmarks: "搜索收藏...",
    noMatchingBookmarks: "没有找到匹配的收藏",
    manageBookmarks: "管理收藏",
    eventRemovedFromBookmarks: "事件已从收藏夹中移除",
    tip: "小贴士",
    dontShowAgain: "不再显示",
    qrCode: "二维码",
    downloadQRCode: "下载二维码",
    qrCodeDownloaded: "二维码已下载",
    savedToDevice: "已保存到您的设备",
    scanQRCodeToView: "扫描此二维码可立即查看日程",
  },
}

// 检测系统语言
function detectSystemLanguage(): Language {
  if (typeof window === "undefined") {
    return "zh" // 默认为中文
  }

  // 获取浏览器语言
  const browserLang = navigator.language.toLowerCase()

  // 如果浏览器语言以zh开头（如zh-CN, zh-TW等），返回中文
  if (browserLang.startsWith("zh")) {
    return "zh"
  }

  // 否则返回英文
  return "en"
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>("zh") // 默认为中文

  // 从localStorage读取语言设置
  const readLanguageFromStorage = () => {
    const storedLanguage = localStorage.getItem("preferred-language")
    if (storedLanguage === "en" || storedLanguage === "zh") {
      return storedLanguage as Language
    }
    return detectSystemLanguage()
  }

  useEffect(() => {
    // 初始化时读取语言设置
    const storedLanguage = readLanguageFromStorage()
    setLanguageState(storedLanguage)

    // 创建一个事件监听器，当localStorage变化时触发
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language") {
        const newLanguage = e.newValue as Language
        if (newLanguage === "en" || newLanguage === "zh") {
          setLanguageState(newLanguage)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("preferred-language", lang)
    // 触发一个自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new Event("languagechange"))
  }

  return [language, setLanguage]
}

