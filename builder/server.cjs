// Compatibility entry point: the builder is now the static React application.
const path = require("path");
import("vite")
  .then(async ({ createServer }) => {
    const server = await createServer({
      root: path.resolve(__dirname, ".."),
      server: { host: "127.0.0.1", port: 4173 },
    });
    await server.listen();
    server.printUrls();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
