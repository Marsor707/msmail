# MSMail

一个基于 `Nuxt 4 + Nitro + Prisma + SQLite` 的微软邮箱账号管理与邮件查询工作台。

它面向“**已经拿到微软邮箱授权信息**”的场景，帮助你集中管理账号、查看最近邮件、进入详情页核对正文，并通过带 `x-api-key` 的只读接口向其他系统提供邮件查询能力。

> [!IMPORTANT]
> 当前版本**不负责 OAuth 授权申请流程**，也**不提供发信能力**。
> 使用前请自行准备可用于 `Graph` 或 `IMAP OAuth2` 的 `client_id` 和 `refresh_token`。

## 功能概览

### 账号管理

- 批量导入邮箱账号，支持文本粘贴和本地 TXT 文件导入
- 导入时可在弹窗中统一选择 `Graph` 或 `IMAP` 收件协议
- 同邮箱重新导入时会覆盖本地凭据，并清空旧 `access_token` 缓存
- 支持左侧列表搜索、勾选导出、单条复制导入串、删除本地配置

### 首页工作台

- 左侧邮箱列表支持关键词搜索和 7 色标签筛选：红、橙、黄、绿、蓝、紫、灰
- 右侧账号卡片支持直接打标签，再次点击同色可清除标签
- 中部概览区展示 `Token 状态`、最近更新时间、未读统计、附件统计、最新来信
- 下方邮件列表支持切换最近 `10 / 20 / 50 / 100` 封

### 邮件读取

- `Graph` 与 `IMAP` 共享同一套账号管理入口
- 支持最近邮件列表、HTML / 纯文本详情、附件状态、已读未读状态展示
- `IMAP` 协议下读取详情时会自动标记为已读
- `IMAP` 当前只覆盖 `INBOX`

### 对外接口

- 提供 `x-api-key` 鉴权的只读 API
- 支持按邮箱获取最近邮件列表
- 支持按邮箱 + `messageId` 获取邮件详情
- 接口返回统一 envelope，便于其他系统直接接入

## 典型使用流程

1. 在首页点击“导入账号”，选择 `Graph` 或 `IMAP`。
2. 粘贴或导入 TXT 文本，格式固定为：

```txt
email----password----client_id----refresh_token
```

3. 导入完成后，在左侧列表搜索、筛选或勾选导出账号。
4. 选中某个邮箱后，在右侧查看状态概览和最近邮件。
5. 进入详情页查看正文；如账号走 `IMAP`，详情读取成功后会同步标记已读。
6. 如需系统间集成，可直接调用 `/api/external/emails` 与 `/api/external/emails/detail`。

> [!NOTE]
> 协议不会写进 TXT 文本，而是在导入弹窗中统一选择；本次导入的账号都会写入当前所选协议。

## 产品截图

> [!NOTE]
> 以下截图均通过 Playwright 重新生成，使用演示数据并已做脱敏处理，不包含真实邮箱、真实 token 或真实邮件正文。

### 首页工作台

![首页工作台](./docs/images/dashboard.png)

### 标签筛选与标签管理

![标签筛选与标签管理](./docs/images/tag-filter-and-detail.png)

### 批量导入弹窗

![批量导入弹窗](./docs/images/import-modal.png)

### 邮件详情页

![邮件详情页](./docs/images/message-detail.png)

## 技术栈

- 前端：Nuxt 4、Vue 3、TypeScript、Ant Design Vue
- 服务端：Nitro Server API
- 数据访问：Prisma
- 默认数据库：SQLite
- 收件协议：Microsoft Graph、IMAP + OAuth2(XOAUTH2)
- 参数校验：Zod
- 内容清洗：DOMPurify

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

默认环境变量如下：

```env
DATABASE_URL="file:./data/mailbox.db"
APP_API_KEY="please-change-me"
MS_TOKEN_ENDPOINT="https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_GRAPH_SCOPE="offline_access Mail.Read"
MS_IMAP_SCOPE="https://outlook.office.com/IMAP.AccessAsUser.All offline_access"
MS_IMAP_HOST="outlook.office365.com"
MS_IMAP_PORT="993"
```

说明：

- `DATABASE_URL` 默认对应仓库中的 `prisma/data/mailbox.db`
- `APP_API_KEY` 用于保护对外只读接口，开源部署时务必替换
- `MS_TOKEN_ENDPOINT` 默认为微软公共租户 token 地址；如你使用自定义租户，可按需覆盖
- `MS_GRAPH_SCOPE` 默认要求 `offline_access Mail.Read`
- `MS_IMAP_SCOPE` 默认要求 `https://outlook.office.com/IMAP.AccessAsUser.All offline_access`
- `MS_IMAP_HOST` / `MS_IMAP_PORT` 为 Outlook IMAP 服务地址

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动开发环境

```bash
npm run dev
```

默认访问地址：

```txt
http://localhost:3000
```

## 常用命令

```bash
# 类型检查
npm run check

# 生成 Prisma Client
npm run prisma:generate

# 同步 Prisma Schema 到数据库
npm run db:push

# 生产构建
npm run build

# 本地预览生产构建
npm run preview

# 重新生成 README 演示截图
npm run readme:screenshots
```

> [!NOTE]
> `npm run readme:screenshots` 会启动本地 Nuxt 开发服务，并使用 `README_SCREENSHOT_MODE=1` 的演示数据重新截图。

## 生产部署

适合当前仓库现状的最小部署流程如下：

```bash
npm install
cp .env.example .env
npm run db:push
npm run build
node .output/server/index.mjs
```

部署建议：

- 修改 `.env` 中的 `APP_API_KEY`，不要使用默认值
- 默认使用 SQLite，适合单机部署；如需多实例或更高并发，建议改造数据库方案后再扩展
- 持久化 `prisma/data/` 目录，避免容器或机器重建后数据丢失
- 对公网提供服务时，建议通过 Nginx、Caddy 或其他反向代理接入 HTTPS
- 如需进程守护，可自行接入 `PM2`、`systemd` 等工具

## 对外接口

所有接口均返回统一结构：

```json
{
  "success": true,
  "code": "OK",
  "message": "ok",
  "data": {}
}
```

### 1. 获取指定邮箱最近邮件

```bash
curl "http://localhost:3000/api/external/emails?email=ops-team@contoso.test&limit=20" \
  -H "x-api-key: your-app-api-key"
```

参数说明：

- `email`：目标邮箱地址
- `limit`：返回数量，范围 `1 ~ 100`，默认 `20`

### 2. 获取邮件详情

```bash
curl "http://localhost:3000/api/external/emails/detail?email=ops-team@contoso.test&messageId=message-id-from-list-api" \
  -H "x-api-key: your-app-api-key"
```

参数说明：

- `email`：目标邮箱地址
- `messageId`：来自列表接口返回结果中的邮件 `id`

补充说明：

- `Graph` 账号：详情接口保持只读
- `IMAP` 账号：详情接口会在读取成功后自动标记已读
- `IMAP` 当前只覆盖 `INBOX`

## 安全说明

- 不要提交真实 `.env`、真实数据库文件、真实导入文本
- 导入数据包含邮箱密码、`client_id`、`refresh_token`，请仅在受控环境中使用
- 开源展示时，统一使用脱敏截图、演示账号和演示接口参数
- README 演示图建议继续使用 `.test` 域名和占位凭据，不要复用真实地址
- 对外接口虽然已支持 `x-api-key` 鉴权，但仍建议配合 IP 白名单、网关或反向代理做进一步保护

## 适用场景

- 管理一批已经完成授权的 Microsoft 邮箱账号
- 作为内部邮件查看工作台，快速定位最近来信
- 为其他系统提供简单的“按邮箱读取邮件”能力
- 用作微软邮箱抓取、只读查询、轻量管理后台的基础模板
