// Verify the same React document used by the editor, thumbnails and static generator.
require("./check-react-layouts.cjs")
  .check()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
