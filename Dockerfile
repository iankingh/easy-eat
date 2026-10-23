FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY easy-eat-front/package*.json easy-eat-front/
RUN npm --prefix easy-eat-front ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 LOCAL_DB_PATH=/data/lunch.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/local-server.mjs /app/scripts/local-d1.mjs ./scripts/
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8787
VOLUME /data
CMD ["node", "scripts/local-server.mjs"]
