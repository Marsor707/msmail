import { z } from 'zod'
import { ACCOUNT_TAG_COLORS } from '~/shared/types'
import { appError, defineApiHandler } from '~/server/utils/api'
import { updateAccountTagById } from '~/server/utils/account-service'

const bodySchema = z.object({
  tagColor: z.union([z.enum(ACCOUNT_TAG_COLORS), z.null()]),
})

export default defineApiHandler(async (event) => {
  if (event.method !== 'PATCH') {
    throw appError(405, 'METHOD_NOT_ALLOWED', '请求方法不支持')
  }

  const rawId = getRouterParam(event, 'id')
  const id = Number(rawId)
  const body = await readBody(event)
  const result = bodySchema.safeParse(body)

  if (!rawId || Number.isNaN(id) || id <= 0) {
    throw appError(400, 'INVALID_ACCOUNT_ID', '账号 ID 不合法')
  }

  if (!result.success) {
    throw appError(400, 'INVALID_BODY', result.error.issues[0]?.message || '请求参数不合法')
  }

  return updateAccountTagById(id, result.data.tagColor)
})
