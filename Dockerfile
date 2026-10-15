FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json vite*.ts index.html ./
COPY public ./public
COPY src ./src
COPY server/commercial.ts ./server/commercial.ts
ARG VITE_DATA_MODE=server
ENV VITE_DATA_MODE=${VITE_DATA_MODE}
RUN npm run build && npm run build:server

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production TZ=America/Sao_Paulo PORT=3001
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node server ./server
COPY --chown=node:node database ./database
COPY --from=build --chown=node:node /app/server-dist ./server-dist
USER node
EXPOSE 3001
CMD ["node","server/index.mjs"]

FROM nginx:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx","-g","daemon off;"]
