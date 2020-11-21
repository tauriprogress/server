require("dotenv").config();
const exec = util.promisify(require("child_process").exec);
const port = process.env.PORT || 3001;
const dev = process.env.DEV_ENV;
const app = require("./src/server");

if (!dev) {
    exec("./redis-stable/src/redis-server ./redis.conf");
}

app.listen(port, () => console.log(`Server running on port ${port}`));
