FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 4000
ENV ENGINE_URL=http://engine:4100
CMD ["npm","start"]
