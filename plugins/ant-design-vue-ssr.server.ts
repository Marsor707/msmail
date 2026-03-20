import { extractStyle } from 'ant-design-vue/es/_util/cssinjs/index.js'

type AntdStyleCache = Parameters<typeof extractStyle>[0]
type HeadStyleEntry = {
  innerHTML: string
  key: string
  type: 'text/css'
  [attribute: string]: string
}

const STYLE_TAG_PATTERN = /<style\s*([^>]*)>([\s\S]*?)<\/style>/g
const STYLE_ATTR_PATTERN = /([^\s=]+)="([^"]*)"/g

function parseAntdStyleTags(styleHtml: string) {
  const styleEntries: HeadStyleEntry[] = []

  for (const match of styleHtml.matchAll(STYLE_TAG_PATTERN)) {
    const rawAttrs = match[1] ?? ''
    const cssText = match[2] ?? ''

    if (!cssText) {
      continue
    }

    const styleEntry: HeadStyleEntry = {
      innerHTML: cssText,
      key: `antdv-ssr-${styleEntries.length}`,
      type: 'text/css',
    }

    for (const attrMatch of rawAttrs.matchAll(STYLE_ATTR_PATTERN)) {
      const attrName = attrMatch[1]
      const attrValue = attrMatch[2]

      if (!attrName || attrValue === undefined) {
        continue
      }

      styleEntry[attrName] = attrValue

      if (attrName === 'data-css-hash' || attrName === 'data-cache-path') {
        styleEntry.key = attrValue
      }
    }

    styleEntries.push(styleEntry)
  }

  return styleEntries
}

function getAntdStyleEntries(cache: AntdStyleCache | undefined) {
  if (!cache) {
    return []
  }

  return parseAntdStyleTags(extractStyle(cache))
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:rendered', ({ ssrContext }) => {
    if (!ssrContext) {
      return
    }

    const globalProperties = nuxtApp.vueApp.config.globalProperties as {
      __ANTDV_CSSINJS_CACHE__?: AntdStyleCache
    }

    const styleEntries = getAntdStyleEntries(globalProperties.__ANTDV_CSSINJS_CACHE__)

    if (!styleEntries.length) {
      return
    }

    // 将本次 SSR 实际命中的 Ant Design 样式直接塞进首屏 head，避免 hydration 前裸样式。
    ssrContext.head.push(
      {
        style: styleEntries,
      },
      {
        mode: 'server',
      },
    )
  })
})
