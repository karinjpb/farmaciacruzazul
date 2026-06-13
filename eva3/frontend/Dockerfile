FROM node:18-alpine

LABEL maintainer="Cruz Azul DevOps Team"
LABEL description="Frontend ERP Cruz Azul - Node.js + Express"

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/api/health || exit 1

CMD ["node", "src/server.js"]
