FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/sim/package.json packages/sim/
COPY packages/data/package.json packages/data/
COPY apps/server/package.json apps/server/
RUN npm install --no-audit --no-fund
COPY packages ./packages
COPY apps/server ./apps/server
RUN npm run build --workspace @exile/data
EXPOSE 8787
CMD ["npm", "run", "start", "--workspace", "@exile/server"]
