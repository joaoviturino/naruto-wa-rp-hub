// PM2 config — mantém o bot ligado 24/7 e reinicia sozinho a cada alteração no código
module.exports = {
  apps: [
    {
      name: "new-era-shinobi-bot",
      script: "index.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: ["index.js"],            // religa quando você edita o código
      ignore_watch: ["node_modules", "auth_state", "logs", ".env"],
      max_memory_restart: "512M",
      restart_delay: 2000,
      exp_backoff_restart_delay: 200, // backoff exponencial em crashes seguidos
      max_restarts: 1000,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};