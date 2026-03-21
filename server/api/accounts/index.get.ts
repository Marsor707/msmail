import { z } from 'zod'
import { defineApiHandler, appError } from '~/server/utils/api'
import { listAccounts } from '~/server/utils/account-service'

const querySchema = z.object({
  keyword: z
    .preprocess(
      (value) => (Array.isArray(value) ? value[0] : value),
      z.string().trim().optional(),
    )
    .transform((value) => value || undefined),
})

export default defineApiHandler(async (event) => {
  const queryResult = querySchema.safeParse(getQuery(event))

  if (!queryResult.success) {
    throw appError(400, 'INVALID_QUERY', queryResult.error.issues[0]?.message || '请求参数不合法')
  }

  return listAccounts({
    keyword: queryResult.data.keyword,
  })
})
