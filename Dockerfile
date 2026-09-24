FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG VITE_SLITHER_SERVER_URL
ENV VITE_SLITHER_SERVER_URL=${VITE_SLITHER_SERVER_URL}
RUN npm run build

FROM nginx:stable-alpine AS web
COPY deploy/nginx-app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-alpine AS arena
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY slither-server.mjs ./
USER node
EXPOSE 8787
CMD ["node", "slither-server.mjs"]
