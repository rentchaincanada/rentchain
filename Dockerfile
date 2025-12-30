# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- run ----
FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Cloud Run uses $PORT
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/app.js"]
