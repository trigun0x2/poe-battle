FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/sim/package.json packages/sim/
COPY packages/data/package.json packages/data/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm run build --workspace @exile/data && npm run build --workspace @exile/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
