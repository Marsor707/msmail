import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { appError } from '~/server/utils/api'

export function assertExternalApiKey(event: H3Event) {
  const config = useRuntimeConfig(event)
  const requestApiKey = getHeader(event, 'x-api-key')

  if (!config.appApiKey) {
    throw appError(500, 'API_KEY_NOT_CONFIGURED', '服务端未配置 APP_API_KEY')
  }

  if (!requestApiKey || requestApiKey !== config.appApiKey) {
    throw appError(401, 'UNAUTHORIZED', 'x-api-key 无效')
  }
}
