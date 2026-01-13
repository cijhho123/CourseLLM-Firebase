# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18-alpine AS deps

WORKDIR /app

# Install system dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# ============================================
# Stage 2: Builder
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY prisma ./prisma/
COPY src ./src/

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:18-alpine AS runner

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl curl postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production dependencies from deps stage
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/prisma ./prisma

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application directly
# Note: GoogleCloudMemoryRepository auto-creates tables via ensureTableExists()
CMD ["node", "dist/main.js"]