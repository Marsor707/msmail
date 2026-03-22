# Repository Guidelines

## Project Structure & Module Organization

- `pages/`：Nuxt 页面路由，首页工作台在 `pages/index.vue`，邮件详情走 `pages/account/[email]/message/[id].vue`。
- `server/api/`：Nitro API 入口，文件名遵循 `name.method.ts`，如 `accounts/import.post.ts`。
- `server/utils/`：服务端核心逻辑，如账号导入、Graph 调用、鉴权与 Prisma 封装。
- `shared/`：前后端共享类型与格式化逻辑。
- `assets/css/`：全局样式；`plugins/` 为 Ant Design Vue 插件注册。
- `prisma/`：Schema 与本地 SQLite 数据目录；`docs/images/` 存放 README 脱敏演示图。

## Build, Test, and Development Commands

- `npm install`：安装依赖。
- `npm run dev`：启动本地开发环境，默认 `http://localhost:3000`。
- `npm run check`：执行 Nuxt 类型检查，提交前必跑。
- `npm run build`：构建生产版本，用于发现 SSR / 打包问题。
- `npm run preview`：本地预览生产构建。
- `npm run prisma:generate`：生成 Prisma Client。
- `npm run db:push`：将 `prisma/schema.prisma` 同步到数据库。

## Coding Style & Naming Conventions

- 使用 TypeScript、Vue 3 `<script setup>` 和 Composition API。
- 统一使用 2 空格缩进，保持现有文件风格，不混用制表符。
- 页面与组件逻辑优先小函数拆分；共享类型放 `shared/`，服务端业务逻辑放 `server/utils/`。
- 文件名保持现有模式：工具与共享模块用 kebab-case，路由文件遵循 Nuxt 文件路由约定。
- 当前仓库未配置 ESLint/Prettier；请至少通过 `npm run check`，并保持导入顺序与代码排版整洁。

## Testing Guidelines

- 当前没有独立 `npm test` 脚本，默认以 `npm run check` + `npm run build` 作为基础门禁。
- 涉及页面改动时，补充手动验证首页、导入弹窗、邮件详情页和外部 API。
- 如新增自动化测试，优先使用 Playwright 做端到端验证，测试文件建议放在新增的 `tests/` 目录。

## Commit & Pull Request Guidelines

- 现有 Git 历史多为简短提交，如 `fix`；新提交建议改为更清晰的祈使句：`fix: retry token refresh`、`docs: update README screenshots`。
- 每次提交只聚焦一个主题，避免把文档、样式、接口改动混在一起。
- PR 需说明变更目的、影响范围、执行过的命令；涉及 UI 时附截图，涉及 `prisma` 或 `.env` 时写明迁移与配置要求。

## Security & Configuration Tips

- 严禁提交真实 `.env`、SQLite 数据库、邮箱密码、`refresh_token`、`APP_API_KEY` 或未脱敏截图。
- README、`docs/images/` 与示例请求统一使用演示数据或脱敏内容。
