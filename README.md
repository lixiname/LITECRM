# Lite CRM Monorepo

面向小团队、线下拜访型 B2B 销售的轻量 CRM。技术规格见 [`docs/重构架构决策与实施蓝图.md`](docs/重构架构决策与实施蓝图.md)。

## 环境准备清单（换机器可跑）

### 前置要求

| 工具       | 版本                        | 说明                                                      |
| ---------- | --------------------------- | --------------------------------------------------------- |
| Node.js    | ≥ 20.19（建议 22.x）        | 见 `.nvmrc` / `engines`                                   |
| pnpm       | 11.x（`devEngines` 已锁定） | `corepack enable` 或独立安装                              |
| Docker     | 任意近期版本                | 本地数据库**二选一**：Docker（推荐）或本机已装 PG         |
| PostgreSQL | 16+                         | Docker 方案由 `docker compose` 提供；本机方案直接用已装的 |

### 首次启动（按顺序）

```bash
# 1. 安装依赖（根目录）
pnpm install

# 2. 起本地数据库（PG16+，二选一，均需 pg_trgm 扩展）
#    A. Docker（推荐）：docker compose up -d db
#    B. 本机已装 PostgreSQL：三条命令分开跑（详见 docs/M0-工程骨架说明.md 步 9）
#       psql -U postgres -c "CREATE USER crm WITH PASSWORD 'crm_dev_password';"
#       psql -U postgres -c "CREATE DATABASE litecrm OWNER crm;"
#       psql -U postgres -d litecrm -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
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

### 新环境数据库与 CI 约束

- 后端测试依赖真实 PostgreSQL 表结构。新机器、空数据库和 GitHub Actions 都必须先执行迁移，再运行 `pnpm test`；否则出现 `relation "users" does not exist` 一类错误，含义是数据库尚未初始化，不是测试造数失败。
- 客户名称模糊检索使用 PostgreSQL `pg_trgm`。首份迁移已声明 `CREATE EXTENSION IF NOT EXISTS pg_trgm`；使用本机 PostgreSQL 且 `crm` 账号没有扩展权限时，仍需先由管理员账号执行上面的扩展安装命令。
- Windows 上若 `drizzle-kit migrate` 出现 `uv_os_get_passwd ... ENOMEM`，可改用 `pnpm --filter @crm/api db:migrate:runtime`。它执行仓库中同一批已提交 SQL 迁移，不是运行时自动同步表结构。
- CI 使用每次全新的 PostgreSQL 容器，执行顺序固定为：安装依赖 → 数据库迁移 → Lint → 类型检查 → 测试 → 构建 → 契约无差异。不要依赖开发机上已经存在的表、扩展或历史迁移记录。
- 判断迁移是否完整，必须至少在空数据库上验证一次；“已有开发库可以继续迁移”不能替代全新建库验证。

### 常用命令

| 命令                                                        | 作用                                    |
| ----------------------------------------------------------- | --------------------------------------- |
| `pnpm dev:*`                                                | 启动 web / mobile / api 开发服务        |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | 全仓库质量门禁（turbo 编排）            |
| `pnpm contracts:generate`                                   | 后端 DTO → Swagger → 契约类型重新生成   |
| `pnpm contracts:check`                                      | 校验契约生成物无 diff（CI 用）          |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`   | Drizzle 迁移生成 / 应用 / Studio 可视化 |
| `pnpm --filter @crm/api db:migrate:runtime`                 | Windows 迁移命令异常时的等价执行入口    |
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
