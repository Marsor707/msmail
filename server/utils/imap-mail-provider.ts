import { useRuntimeConfig } from '#imports'
import type { FetchMessageObject } from 'imapflow'
import { prisma } from '~/server/utils/prisma'
import { appError } from '~/server/utils/api'
import { closeImapClient, createImapClient, withInboxLock } from '~/server/utils/imap-client'
import { toImapMailDetail, toImapMailSummary } from '~/server/utils/mail-parser'
import type { MailProvider, MailProviderAccount } from '~/server/utils/mail-provider-types'
import { refreshMicrosoftAccessToken, formatMicrosoftUpstreamError } from '~/server/utils/microsoft-oauth'

const IMAP_REFRESH_WINDOW = 5 * 60 * 1000

export const imapMailProvider: MailProvider = {
  async listAccountMessages(account, limit) {
    return withImapClient(account, async (client) =>
      withInboxLock(client, async () => {
        const totalMessages = client.mailbox ? client.mailbox.exists : 0

        if (!totalMessages) {
          return []
        }

        const startSequence = Math.max(1, totalMessages - limit + 1)
        const messages: FetchMessageObject[] = []

        for await (const message of client.fetch(`${startSequence}:${totalMessages}`, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          internalDate: true,
        })) {
          messages.push(message)
        }

        return messages.reverse().map(toImapMailSummary)
      }),
    )
  },

  async getAccountMessageDetail(account, messageId) {
    const uid = normalizeMessageUid(messageId)

    return withImapClient(account, async (client) =>
      withInboxLock(client, async () => {
        const message = await client.fetchOne(String(uid), {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          internalDate: true,
          source: true,
        }, {
          uid: true,
        })

        if (!message) {
          throw appError(404, 'MESSAGE_NOT_FOUND', '邮件不存在或已被删除')
        }

        let detail = await toImapMailDetail(message)

        try {
          await client.messageFlagsAdd(uid, ['\\Seen'], {
            uid: true,
            silent: true,
          })
        } catch (error) {
          throw appError(502, 'IMAP_MARK_AS_READ_FAILED', 'IMAP 邮件详情已读取，但标记已读失败', {
            cause: error instanceof Error ? error.message : String(error),
          })
        }

        detail = {
          ...detail,
          isRead: true,
        }

        return detail
      }),
    )
  },
}

async function withImapClient<T>(
  account: MailProviderAccount,
  action: (client: Awaited<ReturnType<typeof createImapClient>>) => Promise<T>,
) {
  const accessToken = await getValidImapAccessToken(account)
  const client = await createImapClient(account, accessToken)

  try {
    return await action(client)
  } catch (error) {
    if (!shouldRetryWithFreshToken(error)) {
      throw error
    }

    await prisma.account.update({
      where: { email: account.email },
      data: {
        accessToken: null,
        tokenExpires: null,
      },
    })

    await closeImapClient(client)

    const freshAccessToken = await getValidImapAccessToken(account, true)
    const retryClient = await createImapClient(account, freshAccessToken)

    try {
      return await action(retryClient)
    } finally {
      await closeImapClient(retryClient)
    }
  } finally {
    if (client.usable) {
      await closeImapClient(client)
    }
  }
}

async function getValidImapAccessToken(account: MailProviderAccount, forceRefresh = false) {
  const now = Date.now()

  if (
    !forceRefresh &&
    account.accessToken &&
    account.tokenExpires &&
    account.tokenExpires.getTime() > now + IMAP_REFRESH_WINDOW
  ) {
    return account.accessToken
  }

  const config = useRuntimeConfig()
  const tokenResponse = await refreshMicrosoftAccessToken({
    clientId: account.clientId,
    refreshToken: account.refreshToken,
    scope: config.msImapScope,
    invalidScopeMessage: '当前 refresh_token 不具备 IMAP OAuth 权限',
    validateScope: hasImapScope,
  })

  await prisma.account.update({
    where: { email: account.email },
    data: {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpires: tokenResponse.expiresAt,
    },
  })

  account.accessToken = tokenResponse.accessToken
  account.refreshToken = tokenResponse.refreshToken
  account.tokenExpires = tokenResponse.expiresAt

  return tokenResponse.accessToken
}

function hasImapScope(scope: string) {
  return scope
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .some((item) => item === 'https://outlook.office.com/imap.accessasuser.all')
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
      formatMicrosoftUpstreamError(statusMessage).includes('访问令牌'))
  )
}

function normalizeMessageUid(messageId: string) {
  const uid = Number.parseInt(messageId, 10)

  if (!Number.isInteger(uid) || uid <= 0) {
    throw appError(400, 'MESSAGE_ID_INVALID', 'IMAP messageId 必须是正整数 UID')
  }

  return uid
}
