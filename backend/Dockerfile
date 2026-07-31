FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/server.js"]
