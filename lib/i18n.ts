"use client"

import { useEffect, useState } from "react"

export type Language = "en" | "zh"

export const translations = {
  en: {
    calendar: "Calendar",
    createEvent: "Create Event",
    myCalendars: "My Calendars",
    addNewCalendar: "Add New Calendar",
    day: "Day",
    week: "Week",
    month: "Month",
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
  },
  zh: {
    calendar: "日历",
    createEvent: "创建日程",
    myCalendars: "我的日历",
    addNewCalendar: "添加新日历",
    day: "日",
    week: "周",
    month: "月",
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
  },
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const detectLanguage = (): Language => {
      const userLanguage = navigator.language.toLowerCase()
      if (userLanguage.startsWith("zh")) {
        return "zh"
      } else {
        return "en"
      }
    }

    setLanguage(detectLanguage())
  }, [])

  return [language, setLanguage]
}

