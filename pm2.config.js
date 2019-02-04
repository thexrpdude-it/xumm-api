module.exports = {
  apps: [{
    name: 'XRPLSIGN',
    script: 'index.js',
    watch: false,
    instances: 1,
    exec_mode: 'cluster',
    ignore_watch: ["node_modules", "db", ".git"],
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
