# Sefaizo API

Documentation rapide pour lancer le backend, synchroniser Prisma, et importer les donnees preprod en local.

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL local

## Installation

```bash
npm install
```

## Lancer l'application

```bash
# dev (watch)
npm run start:dev

# build
npm run build

# run build
npm run start:prod
```

Swagger: `http://localhost:3000/docs`

### Prisma

```bash
npx prisma migrate dev
npx prisma generate
```

```bash
npx prisma studio
```
