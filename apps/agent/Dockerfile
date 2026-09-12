FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 4200
CMD ["npm","start"]
