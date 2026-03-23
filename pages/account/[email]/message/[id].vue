<script setup lang="ts">
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import DOMPurify from 'isomorphic-dompurify'
import type { MailDetail } from '~/shared/types'

const route = useRoute()
const email = computed(() => decodeURIComponent(String(route.params.email || '')))
const messageId = computed(() => decodeURIComponent(String(route.params.id || '')))
const WEB_LINK_PROTOCOL_PATTERN = /^https?:\/\//i
const NEW_TAB_REL_TOKENS = ['noopener', 'noreferrer']

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

const sanitizedBody = computed(() => {
  if (!mail.value) {
    return ''
  }

  if (mail.value.bodyType === 'text') {
    return DOMPurify.sanitize(`<pre>${escapeHtml(mail.value.body)}</pre>`)
  }

  return sanitizeHtmlMailBody(mail.value.body)
})

function scrollViewportToTop() {
  if (!import.meta.client) {
    return
  }

  const resetScrollTop = () => {
    const scrollTargets = [
      document.body,
      document.documentElement,
      document.scrollingElement,
    ].filter((target): target is HTMLElement => Boolean(target))

    for (const target of scrollTargets) {
      target.scrollTop = 0

      if (typeof target.scrollTo === 'function') {
        target.scrollTo({
          top: 0,
          left: 0,
          behavior: 'auto',
        })
      }
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
  }

  resetScrollTop()
  window.requestAnimationFrame(resetScrollTop)
}

async function resetDetailPageScroll() {
  await nextTick()
  scrollViewportToTop()
}

onMounted(() => {
  void resetDetailPageScroll()
})

watch([email, messageId], () => {
  void resetDetailPageScroll()
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

function sanitizeHtmlMailBody(value: string) {
  // 先得到已清洗 DOM，再补充新窗口属性，避免直接改写原始 HTML 字符串。
  const sanitizedBodyElement = DOMPurify.sanitize(value, {
    RETURN_DOM: true,
  }) as HTMLBodyElement

  for (const anchor of sanitizedBodyElement.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href')?.trim() || ''

    if (!WEB_LINK_PROTOCOL_PATTERN.test(href)) {
      continue
    }

    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', mergeAnchorRel(anchor.getAttribute('rel')))
  }

  return sanitizedBodyElement.innerHTML
}

function mergeAnchorRel(value: string | null) {
  const relTokens = new Set((value || '').split(/\s+/).filter(Boolean))

  for (const token of NEW_TAB_REL_TOKENS) {
    relTokens.add(token)
  }

  return Array.from(relTokens).join(' ')
}
</script>

<template>
  <section class="message-page">
    <AAlert
      v-if="errorMessage"
      type="error"
      show-icon
      :message="errorMessage"
    />

    <template v-else-if="mail">
      <ACard class="page-card" :bordered="false">
        <div class="page-card__header message-page__header">
          <div class="page-card__header-main">
            <ATypographyTitle :level="3" style="margin: 0">
              {{ mail.subject || '（无主题）' }}
            </ATypographyTitle>
            <ATypographyParagraph type="secondary" style="margin-bottom: 0">
              {{ mail.preview || '这封邮件没有提供预览摘要。' }}
            </ATypographyParagraph>
          </div>

          <div class="message-header__meta">
            <ABreadcrumb class="page-breadcrumb message-header__breadcrumb">
              <ABreadcrumbItem>
                <NuxtLink to="/">首页工作台</NuxtLink>
              </ABreadcrumbItem>
              <ABreadcrumbItem>{{ email }}</ABreadcrumbItem>
              <ABreadcrumbItem>邮件详情</ABreadcrumbItem>
            </ABreadcrumb>

            <div class="message-header__actions">
              <ATag :color="mail.isRead ? 'default' : 'warning'">
                {{ mail.isRead ? '已读' : '未读' }}
              </ATag>
              <ATag :color="mail.hasAttachments ? 'processing' : 'default'">
                {{ mail.hasAttachments ? '有附件' : '无附件' }}
              </ATag>
              <NuxtLink to="/">
                <AButton>
                  <template #icon>
                    <ArrowLeftOutlined />
                  </template>
                  返回首页
                </AButton>
              </NuxtLink>
            </div>
          </div>
        </div>

        <ADescriptions bordered :column="1" style="margin-top: 24px">
          <ADescriptionsItem label="发件人">
            {{ mail.fromName || '未知发件人' }}（{{ mail.fromAddress }}）
          </ADescriptionsItem>
          <ADescriptionsItem label="接收时间">
            {{ formatDate(mail.receivedAt) }}
          </ADescriptionsItem>
          <ADescriptionsItem label="正文类型">
            {{ mail.bodyType === 'html' ? 'HTML' : '纯文本' }}
          </ADescriptionsItem>
          <ADescriptionsItem label="收件人">
            {{ mail.toRecipients.length ? mail.toRecipients.join('，') : '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem label="抄送">
            {{ mail.ccRecipients.length ? mail.ccRecipients.join('，') : '-' }}
          </ADescriptionsItem>
          <ADescriptionsItem label="Internet Message ID">
            <ATypographyText copyable>
              {{ mail.internetMessageId || '-' }}
            </ATypographyText>
          </ADescriptionsItem>
        </ADescriptions>
      </ACard>

      <ACard class="message-body-card" :bordered="false" title="邮件正文">
        <template #extra>
          <ATag color="blue">
            {{ mail.bodyType === 'html' ? 'HTML' : '纯文本' }}
          </ATag>
        </template>

        <div
          class="mail-body"
          v-html="sanitizedBody"
        />
      </ACard>
    </template>

    <ACard v-else :bordered="false">
      <ASkeleton active :paragraph="{ rows: 8 }" />
    </ACard>
  </section>
</template>
