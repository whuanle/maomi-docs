# 使用 Debian slim 而非 alpine：DuckDB 官方 Node 绑定只提供 glibc 版本，
# 没有 musl 构建，alpine 下会在运行时加载原生模块失败。
FROM node:20-slim AS base

FROM base AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    STATS_DIR=/app/data

# 非 root 运行：应用层万一被拿下，攻击者也拿不到镜像内的写权限
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/config ./config
COPY --from=builder --chown=nextjs:nodejs /app/src/content ./src/content
# DuckDB 平台相关原生绑定是运行时动态 require 的，standalone 追踪可能漏掉，显式拷贝
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@duckdb ./node_modules/@duckdb

# docs 运行时以只读方式挂载（文档内容）；统计库写到 STATS_DIR 指向的独立可写目录，
# 这样文档卷可以 :ro 挂载，被篡改的风险和影响面都更小。
RUN mkdir -p /app/docs /app/data \
 && chown -R nextjs:nodejs /app/data /app/docs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
