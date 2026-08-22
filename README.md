# Lite CRM Monorepo

面向小团队、线下拜访型 B2B 销售的轻量 CRM。技术规格见 [`docs/重构架构决策与实施蓝图.md`](docs/重构架构决策与实施蓝图.md)。

## 环境准备清单（换机器可跑）

### 前置要求

| 工具       | 版本                        | 说明                                    |
| ---------- | --------------------------- | --------------------------------------- |
| Node.js    | ≥ 20.19（建议 22.x）        | 见 `.nvmrc` / `engines`                 |
| pnpm       | 11.x（`devEngines` 已锁定） | `corepack enable` 或独立安装            |
| Docker     | 任意近期版本                | 仅本地数据库用，无 Docker 可本机装 PG16 |
| PostgreSQL | 16+                         | 本地由 `docker compose` 提供            |

### 首次启动（按顺序）

```bash
# 1. 安装依赖（根目录）
pnpm install

# 2. 起本地数据库（PG16 + pg_trgm 扩展）
docker compose up -d db

# 3. 准备环境变量
cp .env.example .env

# 4. 应用数据库迁移（首次）
pnpm db:migrate

# 5. 启动开发服务（三个终端，或各自单独跑）
pnpm dev:web      # 桌面端 http://localhost:5173
pnpm dev:mobile   # 移动端 http://localhost:5174
pnpm dev:api      # API http://localhost:3001/api
```

### 常用命令

| 命令                                                        | 作用                                    |
| ----------------------------------------------------------- | --------------------------------------- |
| `pnpm dev:*`                                                | 启动 web / mobile / api 开发服务        |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | 全仓库质量门禁（turbo 编排）            |
| `pnpm contracts:generate`                                   | 后端 DTO → Swagger → 契约类型重新生成   |
| `pnpm contracts:check`                                      | 校验契约生成物无 diff（CI 用）          |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`   | Drizzle 迁移生成 / 应用 / Studio 可视化 |
| `pnpm format`                                               | Prettier 全量格式化                     |

### 提交流程（husky 门禁已启用）

- 提交信息遵循 Conventional Commits：`feat:` `fix:` `chore:` `docs:` `refactor:` 等
- `pre-commit` 自动执行 lint-staged（eslint --fix + prettier --write）
- `commit-msg` 由 commitlint 校验格式

### 目录速览

```
apps/
  web/       桌面管理后台（Vue 3 + Element Plus）
  mobile/    移动 H5 填报端（Vue 3 + Vant 4）
  api/       NestJS 11 + Drizzle ORM
packages/
  contracts/ openapi-typescript 生成契约（类型唯一来源）
  domain/    两端共享业务层（client / Pinia / composables）
  design-tokens/ 双端统一主题变量
  eslint-config/ 共享 ESLint flat config
  tsconfig/  共享 TypeScript 配置
```
