FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/agent/package.json ./apps/agent/package.json
RUN npm install
COPY apps/agent/tsconfig.json ./apps/agent/tsconfig.json
COPY apps/agent/src ./apps/agent/src
WORKDIR /app/apps/agent
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/agent/package.json ./apps/agent/package.json
COPY --from=builder /app/apps/agent/dist ./apps/agent/dist
WORKDIR /app/apps/agent
ENV NODE_ENV=production
EXPOSE 4200
CMD ["node","dist/index.js"]