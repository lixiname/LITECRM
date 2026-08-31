module.exports = {
  apps: [
    {
      name: 'litecrm-api',
      cwd: __dirname,
      script: 'apps/api/dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
}
