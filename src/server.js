
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);//"For DNS lookups, use Google's DNS (8.8.8.8) and Cloudflare's DNS (1.1.1.1)."

const app = require('./app');

const PORT = process.env.PORT || 5000;

const connectDB = require("./config/db");

console.log("DB FILE:", require.resolve("./config/db"));
console.log("connectDB:", connectDB);
console.log("type:", typeof connectDB);

connectDB();
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
