# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

ENV PORT=3456
ENV NODE_ENV=production

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3456/api/health || exit 1

CMD ["node", "dist/index.js"]
