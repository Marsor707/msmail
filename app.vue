<script setup lang="ts">
const route = useRoute()
const isMailboxPage = computed(() => route.path.startsWith('/account/'))
const showHeader = computed(() => {
  if (route.path === '/') {
    return false
  }

  return !isMailboxPage.value
})

const pageLabel = computed(() => {
  if (route.path === '/') {
    return '账号管理'
  }

  if (route.path.includes('/message/')) {
    return '邮件详情'
  }

  if (route.path.startsWith('/account/')) {
    return '邮件列表'
  }

  return '工作台'
})

const themeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 14,
    colorBgLayout: '#f3f6fb',
    colorTextBase: '#1f2937',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
}
</script>

<template>
  <AConfigProvider :theme="themeConfig">
    <ALayout :class="['app-layout', { 'app-layout--mailbox': isMailboxPage }]">
      <ALayoutHeader v-if="showHeader" class="app-header">
        <div class="app-header__inner">
          <NuxtLink to="/" class="app-brand">
            <span class="app-brand__mark">MS</span>
            <span class="app-brand__text">
              <strong>微软邮箱管理系统</strong>
              <small>前端工作台</small>
            </span>
          </NuxtLink>

          <ATag color="blue" class="app-header__tag">
            {{ pageLabel }}
          </ATag>
        </div>
      </ALayoutHeader>

      <ALayoutContent
        :class="[
          'app-content',
          {
            'app-content--no-header': !showHeader,
          },
        ]"
      >
        <div class="app-content__inner">
          <NuxtPage />
        </div>
      </ALayoutContent>
    </ALayout>
  </AConfigProvider>
</template>
