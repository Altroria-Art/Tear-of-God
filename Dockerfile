# syntax=docker/dockerfile:1.7

# --- Stage 1: Build the Vite app ---
# Vite 8 requires Node ^20.19 || >=22, so use Node 22 LTS (node:18-alpine would fail).
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# Cache the npm registry cache across builds to keep rebuilds fast.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
# VITE_* vars are inlined at build time; passed via docker-compose build args.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

# --- Stage 2: Serve static files with Nginx (stable LTS line) ---
FROM nginx:stable-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Run as the unprivileged nginx user; make the webroot read-only.
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html \
    && chmod -R a-w /usr/share/nginx/html

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
