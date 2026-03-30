import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const port = Number(process.env.README_SCREENSHOT_PORT || '3300')
const baseUrl = `http://${host}:${port}`
const screenshotDir = new URL('../docs/images/', import.meta.url)
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

async function main() {
  await mkdir(fileURLToPath(screenshotDir), { recursive: true })

  const serverProcess = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', host, '--port', String(port)],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        ...process.env,
        README_SCREENSHOT_MODE: '1',
      },
      stdio: 'inherit',
    },
  )

  const cleanup = async () => {
    if (serverProcess.killed || serverProcess.exitCode !== null) {
      return
    }

    serverProcess.kill('SIGTERM')
    await delay(500)

    if (serverProcess.exitCode === null) {
      serverProcess.kill('SIGKILL')
    }
  }

  const exitHandler = async () => {
    await cleanup()
    process.exit(1)
  }

  process.once('SIGINT', exitHandler)
  process.once('SIGTERM', exitHandler)

  try {
    await waitForServer(`${baseUrl}/`)

    const browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      locale: 'zh-CN',
      colorScheme: 'light',
    })
    const page = await context.newPage()

    await captureDashboard(page)
    await captureTagFilter(page)
    await captureImportModal(page)
    await captureMessageDetail(page)

    await browser.close()
  } finally {
    process.removeListener('SIGINT', exitHandler)
    process.removeListener('SIGTERM', exitHandler)
    await cleanup()
  }
}

async function waitForServer(url) {
  const timeoutAt = Date.now() + 90_000

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        return
      }
    } catch {
      // 服务启动前会持续失败，按轮询重试即可。
    }

    await delay(1000)
  }

  throw new Error(`等待本地服务超时：${url}`)
}

async function captureDashboard(page) {
  await page.goto(baseUrl, { waitUntil: 'load' })
  await page.getByRole('heading', { name: '邮箱工作台' }).waitFor()
  await page.locator('.mailbox-list__item-identity-head strong', { hasText: 'alpha.ops@contoso.test' }).first().waitFor()
  await page.locator('.mail-item__subject', { hasText: 'Q1 运维周报与工单汇总' }).first().waitFor()
  await delay(300)

  await page.locator('section.workspace-page').screenshot({
    path: resolveOutput('dashboard.png'),
  })
}

async function captureTagFilter(page) {
  await page.goto(baseUrl, { waitUntil: 'load' })
  await page.getByRole('heading', { name: '邮箱工作台' }).waitFor()
  await delay(500)

  const trigger = page.locator('.workspace-sidebar__tag-trigger').first()
  const popoverMenu = page.locator('.ant-popover:visible .workspace-sidebar__tag-filter-menu')
  await trigger.click()
  await popoverMenu.waitFor()
  await popoverMenu.locator('button[aria-label="蓝色"]').click()
  await page.locator('.mailbox-list__item-identity-head strong', { hasText: 'alpha.ops@contoso.test' }).first().waitFor()
  await delay(300)

  await trigger.click()
  await popoverMenu.waitFor()
  await delay(300)

  await page.locator('.workspace-grid').screenshot({
    path: resolveOutput('tag-filter-and-detail.png'),
  })
}

async function captureImportModal(page) {
  await page.goto(baseUrl, { waitUntil: 'load' })
  await page.getByRole('heading', { name: '邮箱工作台' }).waitFor()
  await page.locator('.mailbox-list__item-identity-head strong', { hasText: 'alpha.ops@contoso.test' }).first().waitFor()
  await delay(1000)
  await page.evaluate(() => {
    const button = document.querySelector('.workspace-sidebar__toolbar .ant-btn-primary')

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('未找到导入按钮')
    }

    button.click()
  })

  const modalTitle = page.locator('.ant-modal:visible .ant-modal-title', { hasText: '批量导入账号' })
  await modalTitle.waitFor()
  await delay(300)

  await page.locator('.ant-select-selector').first().click()
  await page.locator('.ant-select-dropdown .ant-select-item-option').filter({ hasText: 'IMAP' }).first().click()
  await page.getByPlaceholder('user@example.com----password----client-id----refresh-token').fill([
    'ops-demo@contoso.test----DemoPassword!23----demo-client-001----demo-refresh-001',
    'finance-demo@example.test----DemoPassword!24----demo-client-002----demo-refresh-002',
  ].join('\n'))
  await delay(300)

  await page.locator('.ant-modal-content').screenshot({
    path: resolveOutput('import-modal.png'),
  })
}

async function captureMessageDetail(page) {
  const detailUrl = `${baseUrl}/account/alpha.ops%40contoso.test/message/graph-quarterly-report?selectedEmail=alpha.ops%40contoso.test`

  await page.goto(detailUrl, { waitUntil: 'load' })
  await page.getByRole('heading', { name: 'Q1 运维周报与工单汇总' }).waitFor()
  await page.getByText('本周处理概览').waitFor()
  await delay(300)

  await page.locator('section.message-page').screenshot({
    path: resolveOutput('message-detail.png'),
  })
}

function resolveOutput(filename) {
  return fileURLToPath(new URL(filename, screenshotDir))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
