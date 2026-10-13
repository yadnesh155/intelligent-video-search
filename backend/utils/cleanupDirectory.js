const fs = require("fs");

const cleanupDirectory = async (directoryPath) => {
  try {
    await fs.promises.rm(directoryPath, {
      recursive: true,
      force: true,
    });

    console.log(
      `Cleaned up directory: ${directoryPath}`
    );
  } catch (error) {
    console.error(
      `Failed to clean up directory ${directoryPath}:`,
      error.message
    );
  }
};

module.exports = cleanupDirectory;