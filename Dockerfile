FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts/serve.mjs scripts/sharing-api.mjs ./scripts/
RUN mkdir /data && chown node:node /data
ENV LIFEOS_DATA_DIR=/data/shares
ENV PORT=5181
USER node
EXPOSE 5181
CMD ["node", "scripts/serve.mjs"]
