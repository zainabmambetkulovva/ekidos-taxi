FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit
COPY . .
RUN npx prisma generate
RUN npx tsc --skipLibCheck || true
EXPOSE 8080
CMD ["node", "dist/server.js"]
