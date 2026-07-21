FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json /app/backend/package.json
RUN cd /app/backend && npm install --omit=dev

COPY backend /app/backend
COPY frontend /app/frontend
COPY nginx/nginx.conf /etc/nginx/sites-enabled/default
COPY docker/entrypoint.sh /entrypoint.sh
COPY keys /app/keys

RUN chmod +x /entrypoint.sh

ENV PORT=3000

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
