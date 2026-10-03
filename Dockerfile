# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime（多架构，可在树莓派 5 / arm64 上构建运行）----
FROM node:22-alpine
ENV NODE_ENV=production NITRO_PORT=3000 NITRO_HOST=0.0.0.0 \
    UPLOAD_DIR=/data/uploads MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
VOLUME ["/data/uploads"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
CMD ["node", ".output/server/index.mjs"]
