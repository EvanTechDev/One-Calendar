// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // 预览通过代理域名访问，必须放行所有 host，否则 Vite 会拦截跨域请求
      allowedHosts: true,
      cors: true,
    },
  },
  server: {
    host: true,
    port: 4321,
  },
})
