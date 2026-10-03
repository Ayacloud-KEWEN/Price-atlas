# Price Atlas · 多品类商品价格收集器

私人使用的价格收集工具：手机上快速采集（含离线草稿与照片），电脑上核查、整理、比较和查看历史变化。
技术栈：Nuxt 4 / Vue 3 / TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM（迁移）· Docker Compose。
单用户登录，不对公网开放，不连接任何收费服务。

> 已实现/未实现的完整清单见 [FEATURES.md](FEATURES.md)。

## 快速开始（Docker Compose，推荐，含树莓派 5）

```bash
cp .env.example .env
# 编辑 .env：至少修改 ADMIN_PASSWORD、SESSION_SECRET、POSTGRES_PASSWORD
#   SESSION_SECRET 可用： openssl rand -hex 32
docker compose up -d --build
```

然后用浏览器打开 `http://<树莓派地址>:8500`（手机与电脑在同一局域网即可）。

- 数据库迁移与预置分类在应用启动时自动执行（幂等）。
- 镜像基于多架构的 `node:22-alpine` / `postgres:17-alpine`，在 arm64（树莓派 5）上直接构建运行。
- 默认通过 HTTP 在家庭局域网使用，`COOKIE_SECURE=false`。若你自己在前面加了 HTTPS 反向代理，请改为 `true`。
- **请勿把 8500 端口直接映射到公网。** 如需外网访问，请自行使用 VPN（如 WireGuard / Tailscale）或带认证的反向代理。

常用命令：

```bash
docker compose logs -f app      # 查看日志
docker compose ps               # 状态
docker compose down             # 停止（数据保留在卷中）
docker compose up -d --build    # 更新代码后重建
```

## 本地开发（无需 Docker）

```bash
npm install
npm run db:dev          # 另开终端：内嵌 PostgreSQL（PGlite），数据在 .data/pgdata，端口 5455
cp .env.example .env    # 然后改成：
#   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5455/postgres
#   DB_POOL_MAX=1        # PGlite 只支持单连接
#   UPLOAD_DIR=./.data/uploads
npm run dev             # http://localhost:3000
```

使用真实 PostgreSQL 时，把 `DATABASE_URL` 指向它即可（不需要设置 `DB_POOL_MAX`）。

| 命令 | 说明 |
|---|---|
| `npm test` | 单价换算与金额解析单元测试 |
| `npx tsx tests/e2e.ts` | 端到端验收（对运行中的服务发请求，会写入测试数据，**只在开发库运行**） |
| `npm run db:generate` | 修改 `server/db/schema.ts` 后生成新的迁移 |
| `npm run db:migrate` | 手动执行迁移 |
| `npx tsx scripts/seed-demo.ts --confirm` | 写入**虚构**的演示数据（`--remove` 清理）。默认不会混入业务库 |

## 备份与恢复（数据库和照片**两者都要**备份）

业务数据分两部分：**PostgreSQL 数据库**（商品、价格、修改记录、照片元数据）和**照片文件**（`priceatlas_uploads` 卷）。
只备份其中一个，恢复后会出现“有记录没照片”或“有照片没记录”。请始终成对备份、成对恢复。

### 备份

```bash
mkdir -p backup
STAMP=$(date +%Y%m%d-%H%M%S)

# 1) 数据库（自定义格式，便于恢复）
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-priceatlas}" -Fc "${POSTGRES_DB:-priceatlas}" > backup/db-$STAMP.dump

# 2) 照片文件
docker run --rm -v priceatlas_uploads:/data:ro -v "$PWD/backup":/backup alpine \
  tar czf /backup/uploads-$STAMP.tar.gz -C /data .
```

建议用 cron 每天执行并把 `backup/` 同步到另一块磁盘或另一台机器。

### 恢复（到一个全新的部署，或覆盖现有部署）

```bash
docker compose up -d db                     # 先只启动数据库
docker compose stop app                     # 恢复期间必须停掉应用，否则 dropdb 会因连接占用失败
# 1) 数据库
docker compose exec -T db dropdb -U priceatlas --if-exists priceatlas
docker compose exec -T db createdb -U priceatlas priceatlas
docker compose exec -T db pg_restore -U priceatlas -d priceatlas --no-owner < backup/db-XXXX.dump
# 2) 照片
docker volume create priceatlas_uploads
docker run --rm -v priceatlas_uploads:/data -v "$PWD/backup":/backup alpine \
  sh -c "cd /data && tar xzf /backup/uploads-XXXX.tar.gz && chown -R 1000:1000 /data"
docker compose up -d                        # 启动应用
```

> Windows 的 Git Bash 会改写 /backup 之类的路径，在那里运行请先 export MSYS_NO_PATHCONV=1；树莓派（Linux）无此问题。
>
> 先升级再恢复也安全：应用启动时的迁移是幂等的。

## 配置（环境变量）

见 [.env.example](.env.example)。密钥只存在于服务端环境变量中，不会进入前端代码或代码仓库；`.env` 已在 `.gitignore`。

| 变量 | 说明 |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 唯一账号（必填密码） |
| `SESSION_SECRET` | 会话签名密钥，≥ 16 位（建议 64 位十六进制） |
| `SESSION_DAYS` | 会话有效期，默认 30 天 |
| `COOKIE_SECURE` | HTTPS 访问时设为 `true` |
| `DATABASE_URL` | Compose 中自动拼装；本地开发手动设置 |
| `UPLOAD_DIR` | 照片目录（容器内 `/data/uploads`，已挂载持久卷，**不通过 Web 目录公开**） |
| `MAX_UPLOAD_MB` / `MAX_PHOTOS_PER_RECORD` | 单张大小与每条记录照片数上限 |

## 安全说明

- 所有页面、API、照片访问都需要登录；未登录访问页面会 302 到登录页，API 返回 401。
- 照片只通过 `/api/attachments/:id/file` 鉴权后输出；上传目录不在 Web 根目录下。
- 服务端校验输入（zod）、通过**文件头**识别图片格式（JPEG/PNG/WebP/HEIC），限制大小与数量，使用服务端生成的安全文件名。
- 登录有失败限流；写操作有同源（Origin）校验；会话 Cookie 为 HttpOnly + SameSite=Lax。
- 这是私人家用工具，没有做账号找回、多用户、审计报表等功能。

## 离线与 PWA 的限制（请知悉）

- 手机端草稿与待上传照片保存在浏览器 **IndexedDB**（不使用 localStorage 存图片）。
- 应用带有一个很小的 Service Worker，只缓存“应用外壳”和构建产物，**从不缓存 /api 数据与照片**。
- 因此：**必须在联网时至少打开过一次**应用，之后断网才能打开并录入；断网时无法搜索服务器上的商品（只能使用最近缓存的商品列表），无法查看服务器记录。
- 同步只在**应用/网页处于打开状态且在线**时进行；不依赖浏览器关闭后的后台同步。
- 浏览器清除站点数据会删除尚未同步的本机草稿；应用更新只会增加存储结构，不会清空草稿。iOS Safari 对未使用站点的存储可能有回收策略，建议拍完后尽快联网同步。
- 登录过期时，草稿不会丢失；重新登录后在“草稿”页点击“重试”。

## 项目结构

```
app/            前端（页面、组件、IndexedDB 与同步引擎）
server/         API（Nitro）、数据库表结构与迁移执行、鉴权中间件
shared/         前后端共用：单价换算(pricing.ts)、品类模板(templates.ts)
drizzle/        数据库迁移（SQL）
scripts/        迁移、本地开发库、演示数据
tests/          单元测试与端到端验收
```

### 数据模型要点

- `products`（商品/系列）与 `variants`（规格：容量、年份、浓度、包装数量、版本各自独立）分开；不会因名称相似自动合并。
- `observations`（价格观察）每次新增一条，不覆盖历史；记录保存了当时的商品/规格**快照**，之后修改商品资料不会改变历史含义。
- 金额用 `numeric` 精确存储，换算用 decimal.js；标准化单价只在读取时派生，不入库。
- `attributes` 使用 JSONB；`categories` 带 `template`，新增分类与自定义属性（`attribute_defs`）无需改代码。
- `audit_log` 记录价格、规格关联、状态、作废等重要修改的前后值。
- 客户端 `client_id`（记录与附件各一个）上有唯一索引，保证同步幂等。
