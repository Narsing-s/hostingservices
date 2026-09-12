FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install

FROM deps AS builder
WORKDIR /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_NEXUS_API_URL=$NEXT_PUBLIC_NEXUS_API_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node","apps/web/server.js"]
