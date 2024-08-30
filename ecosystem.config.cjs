module.exports = {
  apps: [
    {
      name: 'oms-seller-backend',
      script: './src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
