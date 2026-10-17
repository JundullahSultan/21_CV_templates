// The React document renderer is also the static HTML generator.
async function update(selected = []) {
  return require("./build-app.cjs").renderAssets({
    exportHTML: true,
    selected,
  });
}
if (require.main === module)
  update(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { update };
