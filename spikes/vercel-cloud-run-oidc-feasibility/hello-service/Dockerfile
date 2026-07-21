FROM node:20-alpine

WORKDIR /app

COPY --chown=node:node package.json server.mjs ./

USER node

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.mjs"]
