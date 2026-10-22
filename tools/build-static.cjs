const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

async function buildStatic() {
  // Hosting only bundles the checked-in runtime assets. Browser-based template
  // compilation and thumbnail generation remain part of the local full build.
  const required = (file) => {
    if (!fs.existsSync(path.join(root, "public", file))) {
      throw new Error(
        `Missing generated asset: ${file}. Run npm run build locally and commit public/ before deploying.`,
      );
    }
  };
  required("manifest.json");
  required("sections.json");
  required("branding/logo.png");
  required("site.webmanifest");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "public/manifest.json"), "utf8"),
  );
  const ids = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (
    JSON.stringify(manifest.map((template) => template.id).sort()) !==
    JSON.stringify(ids)
  ) {
    throw new Error(
      "Generated template manifest is out of date. Run npm run build locally and commit public/ before deploying.",
    );
  }
  for (const template of manifest) {
    required(`templates/${template.id}/template.json`);
    required(`templates/${template.id}/template.css`);
    required(template.thumbnail.replace(/^\//, ""));
  }
  process.env.NODE_ENV = "production";
  const { build } = await import("vite");
  await build({ root });
}

if (require.main === module)
  buildStatic().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { buildStatic };
