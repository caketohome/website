# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/.medusa /app/.medusa
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/medusa-config.js ./
COPY --from=builder /app/src/scripts /app/src/scripts

EXPOSE 9000
CMD ["npx", "medusa", "start"]
