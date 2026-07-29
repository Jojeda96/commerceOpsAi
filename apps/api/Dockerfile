FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración del monorepo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/agent-contracts/package.json ./packages/agent-contracts/
COPY packages/evaluation/package.json ./packages/evaluation/
COPY packages/observability/package.json ./packages/observability/
COPY prisma/ ./prisma/

RUN npm ci --ignore-scripts
RUN npx prisma generate

# Copiar código fuente
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npx turbo build --filter=api

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
