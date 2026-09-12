FROM node:26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git docker-cli
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/engine/package.json ./apps/engine/package.json
RUN npm install
COPY apps/engine/tsconfig.json ./apps/engine/tsconfig.json
COPY apps/engine/src ./apps/engine/src
WORKDIR /app/apps/engine
RUN npm run build

FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache git docker-cli
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/engine/package.json ./apps/engine/package.json
COPY --from=builder /app/apps/engine/dist ./apps/engine/dist
WORKDIR /app/apps/engine
ENV NODE_ENV=production
EXPOSE 4100
CMD ["node","dist/index.js"]