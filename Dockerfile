# Dependable Care — production image.
# Single-stage full image: keeps scripts/ and db/ so the same image can both
# run migrations (node scripts/migrate-db.js) and serve the app (next start).
FROM node:22-alpine

# libc6-compat: some npm deps expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install deps against the lockfile first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

# Bind to all interfaces inside the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["npm", "run", "start"]
