# Refine Project — Claude Code Context

## Stack
- **Framework**: Next.js 15 (App Router) + Refine v5
- **UI**: Ant Design (`@refinedev/antd`)
- **Backend**: Supabase (auth + database)
- **Language**: TypeScript strict mode

## Project structure
```
src/
├── app/                  # Next.js App Router pages (CRUD routes per resource)
│   ├── layout.tsx        # ← Refine root: resources registration, providers
│   ├── blog-posts/       # Resource: list / create / edit/[id] / show/[id]
│   └── categories/       # Resource: same structure
├── components/           # auth-page, header
├── contexts/color-mode/  # Light/dark theme context
├── providers/
│   ├── auth-provider/    # auth-provider.client.ts + auth-provider.server.ts
│   ├── data-provider/    # Wraps @refinedev/supabase (client-side only, "use client")
│   └── devtools/
├── utils/supabase/       # client.ts, server.ts, middleware.ts, constants.ts
└── middleware.ts         # Session refresh via updateSession()
```

## Key architectural constraints

- **Data provider is client-side only** (`"use client"` in `src/providers/data-provider/index.ts`). Refine hooks do not work in Server Components. For SSR data needs, use `createSupabaseServerClient()` from `src/utils/supabase/server.ts` directly.
- **All page components must be `"use client"`** since they use Refine hooks.
- **Resource names must match Supabase table names** exactly (e.g. `"blog_posts"`, `"categories"`).
- **Adding a new resource requires two things**: route folder under `src/app/<resource>/` AND registration in `resources={[...]}` in `src/app/layout.tsx`.

## Refine hook reference

| Scenario | Hook | Package |
|---|---|---|
| List with table UI | `useTable` | `@refinedev/antd` |
| List without table UI | `useList<TData, HttpError>` | `@refinedev/core` |
| Show page | `useShow` → returns `{ result, query }` | `@refinedev/core` |
| Create / Edit form | `useForm` — action inferred from route, do not pass `action: "edit"` manually | `@refinedev/antd` |
| Dropdown for related resource | `useSelect` | `@refinedev/antd` |
| Related records (list) | `useMany` / `useOne` | `@refinedev/core` |
| Direct mutations | `useCreate` / `useUpdate` / `useDelete` | `@refinedev/core` |

## Page patterns

**List**: `useTable` + `<Table>` inside `<List>`
**Create/Edit**: `useForm` + `<Form>` inside `<Create>`/`<Edit>`, use `useSelect` for relation dropdowns
**Show**: `useShow` inside `<Show>`, access record via `result`, loading state via `query.isLoading`

## Related data — pick ONE strategy per relation

```tsx
// Option A: Supabase join (preferred for display)
const { tableProps } = useTable({ meta: { select: "*, categories(id,title)" } });
// → access as record.categories.title, no extra hook needed

// Option B: useMany/useOne (when you need full resource data)
const { data: categories } = useMany({ resource: "categories", ids: [...] });
```

**Never combine both for the same relation.** `src/app/blog-posts/page.tsx` and `show/[id]/page.tsx` do this — treat them as legacy, not templates.

## TypeScript rules

- `strict: true` — no `any`. Use `unknown` + type guards where type is uncertain.
- Path aliases: `@*` → `./src/*` (e.g. `@providers/...`, `@utils/...`, `@components/...`, `@contexts/...`). Do not use `@pages/*` — that directory does not exist.
- Type all Refine hooks: `useList<BlogPost, HttpError>`, avoid implicit types on records.
- Avoid `render={(value: any) => ...}` in Ant Design table columns — use typed record models.
- `catch (err: unknown)` — never `catch (err: any)`.

## Supabase boundaries

- **Browser client** (`supabaseBrowserClient`): use in Client Components and provider layer only.
- **Server client** (`createSupabaseServerClient()`): use in Server Components, Route Handlers, middleware.
- Direct Supabase calls are only allowed inside `src/providers/**` and `src/utils/supabase/**`. Pages must go through Refine hooks.

## Middleware

`src/middleware.ts` refreshes the Supabase session on every request. Do not bypass or remove the `updateSession()` call. Do not add business logic here — route guards belong in `authProvider.check`.

## Security

`src/utils/supabase/constants.ts` contains a hardcoded anon key — **known issue, must be migrated**. When touching this file, move values to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Never introduce new hardcoded credentials anywhere in the codebase.

## gstack Skills

Installed at `.claude/skills/gstack`. Available slash commands:

| 命令 | 用途 |
|---|---|
| `/office-hours` | 讨论功能方案，生成设计文档 |
| `/plan-ceo-review` | 从产品角度审查方案 |
| `/plan-eng-review` | 从工程角度审查方案 |
| `/review` | 代码质量审查 |
| `/qa` | 自动浏览器测试 |
| `/cso` | 安全审计 |
| `/ship` | 完整发布流程 |
| `/retro` | 复盘总结 |
| `/careful` | 进入谨慎模式（高风险操作前） |
| `/freeze` | 锁定文件，防止误改 |

Use `/browse` for web browsing tasks.

## Dev commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint
```

---

## Session Log

### 2026-03-26 — gstack 安装

**做了什么**
在项目内安装了 gstack（28 个 AI 开发技能）：
- 路径：`.claude/skills/gstack/`
- Bun 1.3.11 已安装到 `~/.bun/bin/bun`（需要 `export PATH="$HOME/.bun/bin:$PATH"`）
- 运行 `./setup` 成功，28 个技能编译完成，symlink 到 `.claude/skills/`

**踩的坑**

1. **错误方向**：以为需要 `.claude/commands/` 目录（旧方式），创建了 symlinks。实际上官方推荐用 `.claude/skills/`，gstack 已经放对了，后来清理掉了 `.claude/commands/`。

2. **Unknown skill 根本原因**：gstack 28 个技能合计 ~237,832 tokens，但 Claude Code 的 skill description budget 默认只有 16,000 characters（context window 的 2%），技能全被排除导致报 "Unknown skill"。

3. **解决方案**：在 `~/.zshrc` 加了 `export SLASH_COMMAND_TOOL_CHAR_BUDGET=500000`，重启 Claude Code 后生效。**截至记录时还未验证是否成功。**

**重启后验证**
```bash
/context        # 查看哪些 skills 被加载
/office-hours   # 测试能否正常调用
```

---

### 2026-03-26 — 建表 & 插入测试数据

**做了什么**
用 Supabase Management API 创建了三张表并插入测试数据：
- `categories`：id, title
- `blog_posts`：id, title, content, category_id (FK→categories), status, created_at
- `ebay_orders`：id, order_id, buyer_username, item_title, total_price, status, created_at

所有表启用了 RLS + anon 读写策略（开发环境）。迁移文件：`supabase/seed.sql`。

**踩的坑**

1. **字段命名**：`@refinedev/supabase` 自动做 camelCase↔snake_case 转换。前端的 `categoryId` 对应数据库的 `category_id`，`createdAt` 对应 `created_at`。建表时必须用 snake_case，否则外键关系找不到。

2. **Supabase 三种凭证能力不同**：
   - anon key → 只能读写数据（受 RLS 限制）
   - service_role key → 绕过 RLS 读写，但**不能建表**
   - Personal Access Token (PAT, `sbp_...`) → 调 Management API，**可以执行任意 SQL，包括 DDL**
   - 最初误以为 anon key 能建表，尝试 `/rest/v1/sql` 返回 404。

3. **PAT 的位置**：在 `~/.claude/mcp.json` 的 supabase MCP server 配置里，不是项目文件里。

**正确的建表流程**
1. 读页面代码推断字段类型（列名用 snake_case）
2. 从 `~/.claude/mcp.json` 取 PAT
3. 调 `POST https://api.supabase.com/v1/projects/{ref}/database/query` 执行 SQL
4. 用 anon key 查询验证数据是否写入

**项目关键信息**
- Supabase Project Ref: `quzdhrpthwzgmyuwovrq`
- Anon key: 见 `src/utils/supabase/constants.ts`
- PAT: `~/.claude/mcp.json` → mcpServers.supabase.args[3]
