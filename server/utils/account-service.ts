import type {
  AccountTagColor,
  AccountListItem,
  ImportAccountsResult,
  ImportLineError,
  MailProtocol,
} from '~/shared/types'
import { ACCOUNT_TAG_COLORS, MAIL_PROTOCOLS } from '~/shared/types'
import {
  ACCOUNT_IMPORT_SEPARATOR,
  formatAccountImportLine,
} from '~/shared/account-format'
import { appError } from '~/server/utils/api'
import { prisma } from '~/server/utils/prisma'

interface ListAccountsOptions {
  keyword?: string
  tagColor?: AccountTagColor
}

interface AccountRecord {
  id: number
  email: string
  password: string
  clientId: string
  refreshToken: string
  mailProtocol: string
  tagColor: string | null
  accessToken: string | null
  tokenExpires: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function importAccountsFromText(rawText: string, mailProtocol: MailProtocol) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    throw appError(400, 'INVALID_IMPORT_TEXT', '导入内容不能为空')
  }

  const errors: ImportLineError[] = []
  let createdCount = 0
  let updatedCount = 0

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    const parts = line.split(ACCOUNT_IMPORT_SEPARATOR)

    if (parts.length !== 4) {
      errors.push({
        line: lineNumber,
        content: line,
        reason: '格式错误，必须为 email----password----client_id----refresh_token',
      })
      continue
    }

    const [email = '', password = '', clientId = '', refreshToken = ''] = parts.map((part) =>
      part.trim(),
    )

    if (!isValidEmail(email)) {
      errors.push({
        line: lineNumber,
        content: line,
        reason: '邮箱格式不合法',
      })
      continue
    }

    if (!password || !clientId || !refreshToken) {
      errors.push({
        line: lineNumber,
        content: line,
        reason: '密码、client_id、refresh_token 不能为空',
      })
      continue
    }

    const existing = await prisma.account.findUnique({
      where: { email },
      select: { id: true },
    })

    await prisma.account.upsert({
      where: { email },
      update: {
        password,
        clientId,
        refreshToken,
        mailProtocol,
        accessToken: null,
        tokenExpires: null,
      },
      create: {
        email,
        password,
        clientId,
        refreshToken,
        mailProtocol,
      },
    })

    if (existing) {
      updatedCount += 1
    } else {
      createdCount += 1
    }
  }

  return {
    totalLines: lines.length,
    successCount: createdCount + updatedCount,
    updatedCount,
    createdCount,
    errorCount: errors.length,
    errors,
  } satisfies ImportAccountsResult
}

export async function listAccounts(options: ListAccountsOptions = {}) {
  const keyword = options.keyword?.trim()
  const tagColor = normalizeAccountTagColor(options.tagColor)
  const accounts = await prisma.account.findMany({
    where: {
      ...(keyword
        ? {
            email: {
              contains: keyword,
            },
          }
        : {}),
      ...(tagColor
        ? {
            tagColor,
          }
        : {}),
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return accounts.map(toAccountListItem)
}

export async function getAccountByEmail(email: string) {
  const account = await prisma.account.findUnique({
    where: { email },
  })

  if (!account) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '邮箱账号不存在')
  }

  return toAccountListItem(account)
}

export async function exportAccountsByIds(ids: number[]) {
  const uniqueIds = Array.from(new Set(ids))

  if (!uniqueIds.length) {
    throw appError(400, 'INVALID_EXPORT_IDS', '请先勾选要导出的账号')
  }

  const accounts = await prisma.account.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: {
      id: true,
      email: true,
      password: true,
      clientId: true,
      refreshToken: true,
    },
  })

  if (!accounts.length) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '未找到可导出的账号')
  }

  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const exportLines = uniqueIds.flatMap((id) => {
    const account = accountMap.get(id)

    if (!account) {
      return []
    }

    return [
      formatAccountImportLine(account),
    ]
  })

  if (!exportLines.length) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '未找到可导出的账号')
  }

  return exportLines.join('\n')
}

export async function deleteAccountById(id: number) {
  const existing = await prisma.account.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existing) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '账号不存在')
  }

  await prisma.account.delete({
    where: { id },
  })

  return { id }
}

export async function updateAccountTagById(id: number, tagColor: AccountTagColor | null) {
  const existing = await prisma.account.findUnique({
    where: { id },
  })

  if (!existing) {
    throw appError(404, 'ACCOUNT_NOT_FOUND', '账号不存在')
  }

  const account = await prisma.account.update({
    where: { id },
    data: {
      tagColor,
    },
  })

  return toAccountListItem(account)
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeAccountTagColor(value: string | null | undefined): AccountTagColor | null {
  if (!value) {
    return null
  }

  return ACCOUNT_TAG_COLORS.includes(value as AccountTagColor)
    ? (value as AccountTagColor)
    : null
}

export function normalizeMailProtocol(value: string | null | undefined): MailProtocol {
  return MAIL_PROTOCOLS.includes(value as MailProtocol)
    ? (value as MailProtocol)
    : 'graph'
}

function toAccountListItem(account: AccountRecord): AccountListItem {
  return {
    id: account.id,
    email: account.email,
    password: account.password,
    clientId: account.clientId,
    refreshToken: account.refreshToken,
    tagColor: normalizeAccountTagColor(account.tagColor),
    hasRefreshToken: Boolean(account.refreshToken),
    hasAccessToken: Boolean(account.accessToken),
    tokenExpires: account.tokenExpires?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}
