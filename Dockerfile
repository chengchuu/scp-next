FROM node:22-bookworm-slim

WORKDIR /web

COPY . .
COPY ./scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/web/docker-entrypoint.sh"]
