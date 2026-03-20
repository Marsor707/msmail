<template>
  <div class="app-shell">
    <div class="ambient ambient-one" />
    <div class="ambient ambient-two" />

    <header class="topbar">
      <NuxtLink to="/" class="brand-block">
        <span class="brand-mark">MS</span>
        <span class="brand-copy">
          <small>Mail Ops Console</small>
          <strong>微软邮箱管理系统</strong>
        </span>
      </NuxtLink>

      <div class="topbar-meta">
        <span class="tag">Nuxt 3</span>
        <span class="tag">Prisma</span>
        <span class="tag">Microsoft Graph</span>
      </div>
    </header>

    <main class="page-shell">
      <NuxtPage />
    </main>
  </div>
</template>
