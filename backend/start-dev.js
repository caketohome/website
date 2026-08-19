require("dotenv").config();
require("ts-node").register({ transpileOnly: true });
require("tsconfig-paths").register({});

const start = require("@medusajs/medusa/commands/start").default;

const directory = process.cwd();
console.log(`Starting Medusa 2 server in directory ${directory}...`);

start({ directory }).then((res) => {
  console.log("Medusa 2 Server successfully started and listening on port 9000!");
}).catch((err) => {
  console.error("Medusa Start Error:", err);
  process.exit(1);
});
