import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

loadDotenv()

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: resolveDatabaseUrl(process.env.DATABASE_URL),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

function resolveDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL 环境变量')
  }

  if (!databaseUrl.startsWith('file:./')) {
    return databaseUrl
  }

  return `file:${resolve(process.cwd(), 'prisma', databaseUrl.slice('file:'.length))}`
}
