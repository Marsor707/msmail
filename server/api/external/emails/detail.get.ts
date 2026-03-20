import { z } from 'zod'
import { assertExternalApiKey } from '~/server/utils/external-auth'
import { defineApiHandler, appError } from '~/server/utils/api'
import { getAccountMessageDetail } from '~/server/utils/microsoft-graph'

const querySchema = z.object({
  email: z.string().email('邮箱格式不合法'),
  messageId: z.string().trim().min(1, 'messageId 不能为空'),
})

export default defineApiHandler(async (event) => {
  assertExternalApiKey(event)

  const queryResult = querySchema.safeParse(getQuery(event))

  if (!queryResult.success) {
    throw appError(400, 'INVALID_QUERY', queryResult.error.issues[0]?.message || '请求参数不合法')
  }

  return getAccountMessageDetail(queryResult.data.email, queryResult.data.messageId)
})
