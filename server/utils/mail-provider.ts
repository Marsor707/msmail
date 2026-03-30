import type { MailProtocol } from '~/shared/types'
import { appError } from '~/server/utils/api'
import { normalizeMailProtocol } from '~/server/utils/account-service'
import { prisma } from '~/server/utils/prisma'
import { imapMailProvider } from '~/server/utils/imap-mail-provider'
import type { MailProvider, MailProviderAccount } from '~/server/utils/mail-provider-types'
import {
  getGraphAccountMessageDetail,
  listGraphAccountMessages,
} from '~/server/utils/microsoft-graph'

const graphMailProvider: MailProvider = {
  listAccountMessages(account, limit) {
    return listGraphAccountMessages(account.email, limit)
  },
  getAccountMessageDetail(account, messageId) {
    return getGraphAccountMessageDetail(account.email, messageId)
  },
}

export async function listAccountMessages(email: string, limit: number) {
  const account = await getMailProviderAccount(email)
  return resolveMailProvider(account.mailProtocol).listAccountMessages(account, limit)
}

export async function getAccountMessageDetail(email: string, messageId: string) {
  const account = await getMailProviderAccount(email)
  return resolveMailProvider(account.mailProtocol).getAccountMessageDetail(account, messageId)
}

async function getMailProviderAccount(email: string): Promise<MailProviderAccount> {
  const account = await prisma.account.findUnique({
    where: { email },
    select: {
      email: true,
      clientId: true,
      refreshToken: true,
      accessToken: true,
      tokenExpires: true,
      mailProtocol: true,
    },
  })

  if (!account) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '邮箱账号不存在')
  }

  return {
    ...account,
    mailProtocol: normalizeMailProtocol(account.mailProtocol),
  }
}

function resolveMailProvider(mailProtocol: MailProtocol) {
  return mailProtocol === 'imap' ? imapMailProvider : graphMailProvider
}
