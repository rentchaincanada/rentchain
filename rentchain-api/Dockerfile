FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start the build-safe entrypoint
CMD ["node", "dist/index.build.js"]
