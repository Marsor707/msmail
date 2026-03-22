import { z } from 'zod'
import { defineApiHandler, appError } from '~/server/utils/api'
import { getAccountByEmail } from '~/server/utils/account-service'

const querySchema = z.object({
  email: z.string().email('邮箱格式不合法'),
})

export default defineApiHandler(async (event) => {
  const queryResult = querySchema.safeParse(getQuery(event))

  if (!queryResult.success) {
    throw appError(400, 'INVALID_QUERY', queryResult.error.issues[0]?.message || '请求参数不合法')
  }

  return getAccountByEmail(queryResult.data.email)
})
