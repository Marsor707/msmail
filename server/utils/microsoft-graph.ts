import { useRuntimeConfig } from '#imports'
import { appError } from '~/server/utils/api'
import { prisma } from '~/server/utils/prisma'
import type { MailDetail, MailSummary } from '~/shared/types'
import { refreshMicrosoftAccessToken, requestJson } from '~/server/utils/microsoft-oauth'

interface GraphListResponse {
  value?: Array<{
    id?: string
    subject?: string | null
    from?: {
      emailAddress?: {
        name?: string | null
        address?: string | null
      }
    }
    receivedDateTime?: string
    hasAttachments?: boolean
    isRead?: boolean
  }>
}

interface GraphDetailResponse {
  id?: string
  subject?: string | null
  from?: {
    emailAddress?: {
      name?: string | null
      address?: string | null
    }
  }
  toRecipients?: Array<{
    emailAddress?: {
      address?: string | null
    }
  }>
  ccRecipients?: Array<{
    emailAddress?: {
      address?: string | null
    }
  }>
  receivedDateTime?: string
  hasAttachments?: boolean
  isRead?: boolean
  internetMessageId?: string | null
  bodyPreview?: string | null
  body?: {
    contentType?: string | null
    content?: string | null
  }
}

export async function listGraphAccountMessages(email: string, limit: number) {
  const params = new URLSearchParams({
    '$select': 'id,subject,from,receivedDateTime,hasAttachments,isRead',
    '$orderby': 'receivedDateTime DESC',
    '$top': String(limit),
  })
  const response = await withGraphRetry(
    email,
    async (accessToken) =>
      graphRequest<GraphListResponse>(
        `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`,
        accessToken,
      ),
  )

  return (response.value ?? [])
    .filter((message) => message.id)
    .map(
      (message) =>
        ({
          id: message.id!,
          subject: message.subject?.trim() || '(无主题)',
          fromName: message.from?.emailAddress?.name?.trim() || '未知发件人',
          fromAddress: message.from?.emailAddress?.address?.trim() || '-',
          receivedAt: message.receivedDateTime || '',
          hasAttachments: Boolean(message.hasAttachments),
          isRead: Boolean(message.isRead),
        }) satisfies MailSummary,
    )
}

export async function getGraphAccountMessageDetail(email: string, messageId: string) {
  const params = new URLSearchParams({
    '$select':
      'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments,isRead,internetMessageId',
  })
  const response = await withGraphRetry(
    email,
    async (accessToken) =>
      graphRequest<GraphDetailResponse>(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
        accessToken,
      ),
  )

  if (!response.id) {
    throw appError(502, 'GRAPH_RESPONSE_INVALID', '微软邮件详情返回异常')
  }

  return {
    id: response.id,
    subject: response.subject?.trim() || '(无主题)',
    fromName: response.from?.emailAddress?.name?.trim() || '未知发件人',
    fromAddress: response.from?.emailAddress?.address?.trim() || '-',
    toRecipients: (response.toRecipients ?? [])
      .map((item) => item.emailAddress?.address?.trim())
      .filter((item): item is string => Boolean(item)),
    ccRecipients: (response.ccRecipients ?? [])
      .map((item) => item.emailAddress?.address?.trim())
      .filter((item): item is string => Boolean(item)),
    receivedAt: response.receivedDateTime || '',
    isRead: Boolean(response.isRead),
    hasAttachments: Boolean(response.hasAttachments),
    internetMessageId: response.internetMessageId?.trim() || '-',
    bodyType: response.body?.contentType?.toLowerCase() === 'text' ? 'text' : 'html',
    body: response.body?.content || '',
    preview: response.bodyPreview?.trim() || '',
  } satisfies MailDetail
}

export async function getValidAccessToken(email: string, forceRefresh = false) {
  const account = await prisma.account.findUnique({
    where: { email },
  })

  if (!account) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '邮箱账号不存在')
  }

  const now = Date.now()
  const refreshWindow = 5 * 60 * 1000

  if (
    !forceRefresh &&
    account.accessToken &&
    account.tokenExpires &&
    account.tokenExpires.getTime() > now + refreshWindow
  ) {
    return account.accessToken
  }

  const config = useRuntimeConfig()
  const tokenResponse = await refreshMicrosoftAccessToken({
    clientId: account.clientId,
    refreshToken: account.refreshToken,
    scope: config.msGraphScope,
    invalidScopeMessage: '当前 refresh_token 换取到的不是 Graph Mail.Read 令牌，请确认原始授权包含 Mail.Read',
    validateScope: hasMailReadScope,
  })

  await prisma.account.update({
    where: { email },
    data: {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpires: tokenResponse.expiresAt,
    },
  })

  return tokenResponse.accessToken
}

async function graphRequest<T>(url: string, accessToken: string) {
  return requestJson<T>(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
}

function hasMailReadScope(scope: string) {
  return scope
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .some((item) => item === 'mail.read' || item === 'https://graph.microsoft.com/mail.read')
}

function formatUpstreamError(message: string) {
  if (!message) {
    return '微软接口调用失败'
  }

  if (message.includes('IDX14100')) {
    return '微软 Graph 拒绝了当前访问令牌。通常表示 refresh_token 换出来的不是 Graph Mail.Read 访问令牌，请确认授权时包含 Mail.Read 和 offline_access。'
  }

  return message
}

async function withGraphRetry<T>(
  email: string,
  action: (accessToken: string) => Promise<T>,
) {
  try {
    const accessToken = await getValidAccessToken(email)
    return await action(accessToken)
  } catch (error) {
    if (!shouldRetryWithFreshToken(error)) {
      throw error
    }

    await prisma.account.update({
      where: { email },
      data: {
        accessToken: null,
        tokenExpires: null,
      },
    })

    const freshAccessToken = await getValidAccessToken(email, true)
    return action(freshAccessToken)
  }
}

function shouldRetryWithFreshToken(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return false
  }

  const data = (error as { data?: Record<string, unknown> }).data
  const statusCode = (error as { statusCode?: number }).statusCode
  const statusMessage = (error as { statusMessage?: string }).statusMessage || ''

  return (
    data?.code === 'MICROSOFT_API_ERROR' &&
    (data?.upstreamStatus === 401 ||
      statusCode === 502 ||
      statusMessage.includes('IDX14100') ||
      statusMessage.includes('访问令牌'))
  )
}
