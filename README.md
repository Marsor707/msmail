# 微软邮箱管理系统

基于 `Nuxt 3 + Nitro + Prisma + SQLite` 的微软邮箱管理站点，支持：

- 批量导入邮箱账号
- 删除账号
- 查看指定邮箱的邮件列表
- 查看邮件详情正文
- 对外提供带 `x-api-key` 的邮件列表/详情查询接口

## 启动方式

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 初始化数据库

```bash
npm run db:push
```

4. 启动开发环境

```bash
npm run dev
```

## 对外接口

### 获取邮件列表

```http
GET /api/external/emails?email=user@example.com&limit=20
x-api-key: your-api-key
```

### 获取邮件详情

```http
GET /api/external/emails/detail?email=user@example.com&messageId=<messageId>
x-api-key: your-api-key
```
