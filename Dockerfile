# Stage 1: Install dependencies
FROM oven/bun:1.3-alpine AS deps

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install production dependencies only (skip native build scripts)
RUN bun install --frozen-lockfile --production --ignore-scripts

# Stage 2: Build stage (if needed for dev dependencies)
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install all dependencies including dev dependencies (skip native build scripts)
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Stage 3: Production runtime
FROM oven/bun:1.3-alpine AS runtime

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=bunuser:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=bunuser:nodejs . .

# Switch to non-root user
USER bunuser

# Expose port (adjust if needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "src/main.ts"]
