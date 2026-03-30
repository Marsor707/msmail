import { useRuntimeConfig } from '#imports'
import { appError } from '~/server/utils/api'

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

interface RefreshOptions {
  clientId: string
  refreshToken: string
  scope: string
  invalidScopeMessage: string
  validateScope: (scope: string) => boolean
}

export interface MicrosoftAccessTokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export async function refreshMicrosoftAccessToken(
  options: RefreshOptions,
): Promise<MicrosoftAccessTokenResult> {
  const config = useRuntimeConfig()
  const body = new URLSearchParams({
    client_id: options.clientId,
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
    scope: options.scope,
  })
  const tokenResponse = await requestJson<TokenResponse>(config.msTokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!tokenResponse.access_token || !tokenResponse.expires_in) {
    throw appError(
      502,
      'TOKEN_REFRESH_INVALID_RESPONSE',
      tokenResponse.error_description || '微软 token 刷新返回缺少关键字段',
    )
  }

  if (tokenResponse.token_type?.toLowerCase() !== 'bearer') {
    throw appError(502, 'TOKEN_TYPE_INVALID', '微软 token 刷新返回了非 Bearer 令牌', {
      tokenType: tokenResponse.token_type || null,
    })
  }

  if (tokenResponse.scope && !options.validateScope(tokenResponse.scope)) {
    throw appError(502, 'TOKEN_SCOPE_INVALID', options.invalidScopeMessage, {
      scope: tokenResponse.scope,
    })
  }

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || options.refreshToken,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
  }
}

export async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (error) {
    throw appError(502, 'UPSTREAM_REQUEST_FAILED', '请求微软服务失败', {
      cause: error instanceof Error ? error.message : String(error),
    })
  }

  let payload: unknown = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message = formatUpstreamError(extractUpstreamMessage(payload))
    throw appError(response.status === 401 ? 502 : 500, 'MICROSOFT_API_ERROR', message, {
      upstreamStatus: response.status,
    })
  }

  return payload as T
}

export function formatMicrosoftUpstreamError(message: string) {
  return formatUpstreamError(message)
}

function extractUpstreamMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error_description' in payload &&
    typeof payload.error_description === 'string'
  ) {
    return payload.error_description
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message
  }

  return ''
}

function formatUpstreamError(message: string) {
  if (!message) {
    return '微软接口调用失败'
  }

  if (message.includes('IDX14100')) {
    return '微软服务拒绝了当前访问令牌，请确认 refresh_token 对应授权仍然有效。'
  }

  return message
}
