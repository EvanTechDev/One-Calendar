---
linkTitle: "Getting Started"
title: Deploy
next: /docs/mail/getting-started
sidebar:
  open: true
---

Get the [Resend API KEY](https://resend.com)

> [!NOTE]\
> How to get Resend API KEY? 
> [Learn the doc](https://resend.com/docs/dashboard/api-keys/introduction)


Then fill in the .env file: 

```env
RESEND_API_KEY=YOUR_RESEND_API_KEY
```

And fill in your access password and domain(Without https:///):

```env
ACCESS_PASSWORD=123456
DOMAIN=example.com
```

Then run 

```
npm run dev
```

Finally, open your browser and visit [https://localhost:3000/](https://localhost:3000/)
