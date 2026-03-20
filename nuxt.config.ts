import { fileURLToPath } from 'node:url'

const dayjsEsmRoot = fileURLToPath(new URL('./node_modules/dayjs/esm/', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-03-20',
  devtools: {
    enabled: true,
  },
  css: ['ant-design-vue/dist/reset.css', '~/assets/css/main.css'],
  build: {
    transpile: ['ant-design-vue'],
  },
  vite: {
    resolve: {
      alias: [
        {
          find: /^dayjs$/,
          replacement: `${dayjsEsmRoot}index.js`,
        },
        {
          find: /^dayjs\/plugin\/(.*)$/,
          replacement: `${dayjsEsmRoot}plugin/$1/index.js`,
        },
        {
          find: /^dayjs\/locale\/(.*)$/,
          replacement: `${dayjsEsmRoot}locale/$1.js`,
        },
      ],
    },
  },
  runtimeConfig: {
    appApiKey: process.env.APP_API_KEY,
    msTokenEndpoint:
      process.env.MS_TOKEN_ENDPOINT ??
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    msGraphScope: process.env.MS_GRAPH_SCOPE ?? 'offline_access Mail.Read',
    public: {
      appName: '微软邮箱管理系统',
    },
  },
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true,
      },
    },
  },
})
