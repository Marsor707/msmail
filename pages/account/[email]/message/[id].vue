<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'
import type { MailDetail } from '~/shared/types'

const route = useRoute()
const email = computed(() => decodeURIComponent(String(route.params.email || '')))
const messageId = computed(() => decodeURIComponent(String(route.params.id || '')))

const { data } = await useAsyncData(
  () => `message-detail:${email.value}:${messageId.value}`,
  () =>
    useApiRequest<MailDetail>(
      `/api/accounts/message-detail?email=${encodeURIComponent(email.value)}&messageId=${encodeURIComponent(messageId.value)}`,
    ),
)

const response = computed(() => data.value)
const mail = computed(() => {
  if (!response.value?.success || !response.value.data) {
    return null
  }

  return {
    ...response.value.data,
    toRecipients: Array.isArray(response.value.data.toRecipients)
      ? response.value.data.toRecipients
      : [],
    ccRecipients: Array.isArray(response.value.data.ccRecipients)
      ? response.value.data.ccRecipients
      : [],
  }
})
const errorMessage = computed(() => (response.value?.success === false ? response.value.message : ''))
const messageStats = computed(() => {
  if (!mail.value) {
    return []
  }

  return [
    {
      label: '接收时间',
      value: formatDate(mail.value.receivedAt),
    },
    {
      label: '正文类型',
      value: mail.value.bodyType === 'html' ? 'HTML' : '纯文本',
    },
    {
      label: '收件人数',
      value: `${mail.value.toRecipients.length} 人`,
    },
    {
      label: '抄送人数',
      value: `${mail.value.ccRecipients.length} 人`,
    },
  ]
})

const sanitizedBody = computed(() => {
  if (!mail.value) {
    return ''
  }

  if (mail.value.bodyType === 'text') {
    return DOMPurify.sanitize(`<pre>${escapeHtml(mail.value.body)}</pre>`)
  }

  return DOMPurify.sanitize(mail.value.body)
})

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
</script>

<template>
  <section class="detail-stack">
    <div
      v-if="errorMessage"
      class="error-box"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="mail">
      <div class="surface-card page-hero">
        <div class="breadcrumb">
          <NuxtLink to="/">账号管理</NuxtLink>
          <span>/</span>
          <NuxtLink :to="`/account/${encodeURIComponent(email)}`">{{ email }}</NuxtLink>
          <span>/</span>
          <span>邮件详情</span>
        </div>

        <div class="page-hero-head">
          <div>
            <span class="eyebrow-chip">Message Detail</span>
            <h1 class="page-title">{{ mail.subject || '（无主题）' }}</h1>
            <p class="page-subtitle">
              {{ mail.preview || '这封邮件没有提供预览摘要。' }}
            </p>
          </div>

          <div class="chip-row">
            <span
              class="status-badge"
              :class="mail.isRead ? 'neutral' : 'warning'"
            >
              {{ mail.isRead ? '已读' : '未读' }}
            </span>
            <span class="status-badge neutral">
              {{ mail.hasAttachments ? '有附件' : '无附件' }}
            </span>
          </div>
        </div>

        <div class="sender-strip">
          <span class="overline">发件人</span>
          <strong>{{ mail.fromName || '未知发件人' }}</strong>
          <span>{{ mail.fromAddress }}</span>
        </div>

        <div class="inline-metrics">
          <article
            v-for="item in messageStats"
            :key="item.label"
            class="compact-metric"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>

        <div class="recipient-grid">
          <article class="recipient-card">
            <span class="overline">收件人</span>
            <p>{{ mail.toRecipients.length ? mail.toRecipients.join('，') : '-' }}</p>
          </article>
          <article class="recipient-card">
            <span class="overline">抄送</span>
            <p>{{ mail.ccRecipients.length ? mail.ccRecipients.join('，') : '-' }}</p>
          </article>
          <article class="recipient-card">
            <span class="overline">Internet Message ID</span>
            <code class="mono-text">{{ mail.internetMessageId || '-' }}</code>
          </article>
        </div>
      </div>

      <div class="surface-card mail-body-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">邮件正文</h2>
            <p class="section-desc">正文内容已做安全清洗，支持 HTML 与纯文本两种展示模式。</p>
          </div>
        </div>

        <div
          class="mail-body"
          v-html="sanitizedBody"
        />
      </div>
    </template>

    <div
      v-else
      class="empty-box"
    >
      正在加载邮件详情...
    </div>
  </section>
</template>
