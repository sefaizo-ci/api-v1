// PM2 ecosystem — starts the API server and the BullMQ worker.
//
// Usage:
//   npm run build
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup
//
// Sensitive env vars (DATABASE_URL, JWT_SECRET, REDIS_URL, etc.) must be set
// on the server before starting — either via a .env file in the project root
// (loaded automatically by NestJS ConfigModule) or via system environment.

module.exports = {
  apps: [
    {
      name: 'sefaizo-api',
      script: './dist/src/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'sefaizo-worker',
      script: './dist/src/worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
