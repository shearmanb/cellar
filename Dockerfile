# Explicit build environment — Railway builds this Dockerfile directly,
# so the Node version is exact and not inferred by any builder.
FROM node:22-slim

# Prisma's query engine needs OpenSSL
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (postinstall runs `prisma generate`, which needs the schema)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
