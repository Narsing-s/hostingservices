FROM node:26-alpine AS base
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install

FROM base AS api-builder
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src
WORKDIR /app/apps/api
RUN npm run build

FROM node:26-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node","dist/index.js"]

FROM base AS web-builder
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_NEXUS_API_URL=$NEXT_PUBLIC_NEXUS_API_URL
RUN npm run build

FROM node:26-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node","server.js"]
