---
linkTitle: "快速开始"
title: 部署
next: /docs/mail/getting-started
sidebar:
  open: true
---

获取 [Resend API KEY](https://resend.com)

> [!NOTE]\
> 如何获得 Resend API KEY?
> [查看文档](https://resend.com/docs/dashboard/api-keys/introduction)


然后填写入 .env 文件：

```env
RESEND_API_KEY=YOUR_RESEND_API_KEY
```

接着填写访问密码和域名（不带https:///）到.env文件:

```env
ACCESS_PASSWORD=123456
DOMAIN=example.com
```

然后运行

```
npm run dev
```

最后，打开浏览器访问 [https://localhost:3000/](https://localhost:3000/)
