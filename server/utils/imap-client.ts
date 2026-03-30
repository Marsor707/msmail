import { useRuntimeConfig } from '#imports'
import { ImapFlow } from 'imapflow'
import type { MailProviderAccount } from '~/server/utils/mail-provider-types'
import { appError } from '~/server/utils/api'

export async function createImapClient(account: MailProviderAccount, accessToken: string) {
  const config = useRuntimeConfig()
  const client = new ImapFlow({
    host: config.msImapHost,
    port: config.msImapPort,
    secure: true,
    auth: {
      user: account.email,
      accessToken,
    },
    logger: false,
  })

  try {
    await client.connect()
  } catch (error) {
    client.close()
    throw mapImapConnectionError(error)
  }

  return client
}

export async function withInboxLock<T>(
  client: ImapFlow,
  action: () => Promise<T>,
) {
  const lock = await client.getMailboxLock('INBOX')

  try {
    return await action()
  } finally {
    lock.release()
  }
}

export async function closeImapClient(client: ImapFlow) {
  try {
    await client.logout()
  } catch {
    client.close()
  }
}

function mapImapConnectionError(error: unknown) {
  if (isAuthenticationFailure(error)) {
    return appError(502, 'IMAP_AUTH_FAILED', 'IMAP OAuth 登录失败，请确认 refresh_token 对应账号仍具备 IMAP 权限')
  }

  return appError(502, 'IMAP_CONNECTION_FAILED', 'IMAP 服务器连接失败', {
    cause: error instanceof Error ? error.message : String(error),
  })
}

function isAuthenticationFailure(error: unknown): error is { authenticationFailed: true } {
  return Boolean(error && typeof error === 'object' && 'authenticationFailed' in error)
}
