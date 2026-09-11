FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git docker-cli
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 4100
CMD ["npm","start"]
