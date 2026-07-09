---
linkTitle: "URL 添加活动"
title: 如何使用 URL 添加活动
---

本文档将帮助您如何使用 url 添加一个或多个活动

格式：`?events=标题,开始时间,结束时间,简介,位置,颜色,参与者`

## 支持的参数

- `title` 或 `name`：活动标题（必填）
- `date` 或 `startDate`：开始日期（默认为明天）
- `endDate`：结束日期（默认为开始时间后 1 小时）
- `description`：活动描述
- `location`：活动地点
- `participants`：参与者
- `color`：活动颜色（可选值：blue, green, red, yellow, purple, pink, indigo, orange, teal）

## 日期格式

支持以下日期格式：

- `yyyy.mm.dd.hh.minute`：例如`2024.03.25.14.30` 表示 2024 年 3 月 25 日 14:3
- 相对时间：
- `1h`：1 小时后
- `2.5h`：2.5 小时后
- `30m`：30 分钟后
- `1d2:00`：明天 2 点
- `2d`：2 天后
- `1d3h30m`：1 天 3 小时 30 分钟后

## 示例

```
https://calendar.xyehr.cn/?events=Name,1d9:00,1d11:30,Description,Home(Location),yellow,Evan
```

如果您需要跳过一些可选项，则需要将此处留空。

例如（我不想添加描述和位置）：

```
https://calendar.xyehr.cn/?events=Name,1d9:00,1d11:30,,,yellow,Evan
```
