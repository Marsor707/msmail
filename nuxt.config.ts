export default defineNuxtConfig({
  compatibilityDate: '2026-03-20',
  devtools: {
    enabled: true,
  },
  css: ['~/assets/css/main.css'],
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
