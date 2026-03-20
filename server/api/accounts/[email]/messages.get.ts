import { z } from 'zod'
import { defineApiHandler, appError } from '~/server/utils/api'
import { listAccountMessages } from '~/server/utils/microsoft-graph'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineApiHandler(async (event) => {
  const email = decodeURIComponent(getRouterParam(event, 'email') || '')
  const queryResult = querySchema.safeParse(getQuery(event))

  if (!email) {
    throw appError(400, 'EMAIL_REQUIRED', '邮箱不能为空')
  }

  if (!queryResult.success) {
    throw appError(400, 'INVALID_LIMIT', 'limit 必须是 1 到 100 之间的整数')
  }

  return listAccountMessages(email, queryResult.data.limit)
})
