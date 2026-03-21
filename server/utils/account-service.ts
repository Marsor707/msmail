import type { ImportAccountsResult, ImportLineError } from '~/shared/types'
import {
  ACCOUNT_IMPORT_SEPARATOR,
  formatAccountImportLine,
} from '~/shared/account-format'
import { appError } from '~/server/utils/api'
import { prisma } from '~/server/utils/prisma'

export async function importAccountsFromText(rawText: string) {
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
        accessToken: null,
        tokenExpires: null,
      },
      create: {
        email,
        password,
        clientId,
        refreshToken,
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

export async function listAccounts() {
  const accounts = await prisma.account.findMany({
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return accounts.map((account: (typeof accounts)[number]) => ({
    id: account.id,
    email: account.email,
    password: account.password,
    clientId: account.clientId,
    refreshToken: account.refreshToken,
    hasRefreshToken: Boolean(account.refreshToken),
    hasAccessToken: Boolean(account.accessToken),
    tokenExpires: account.tokenExpires?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }))
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
