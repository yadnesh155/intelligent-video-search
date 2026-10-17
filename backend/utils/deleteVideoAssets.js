const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const uploadsRoot = path.resolve(backendRoot, "uploads");

const getSafeUploadPath = (storedPath) => {
  if (
    typeof storedPath !== "string" ||
    storedPath.trim() === ""
  ) {
    return null;
  }

  const absolutePath = path.isAbsolute(storedPath)
    ? path.resolve(storedPath)
    : path.resolve(backendRoot, storedPath);

  const isInsideUploads =
    absolutePath === uploadsRoot ||
    absolutePath.startsWith(`${uploadsRoot}${path.sep}`);

  // Skip stale or unsafe paths instead of deleting
  // files outside the current uploads directory.
  return isInsideUploads ? absolutePath : null;
};

const deleteVideoAssets = async (video) => {
  const videoFilePath = getSafeUploadPath(video.path);

  if (videoFilePath) {
    await fs.promises.rm(videoFilePath, {
      force: true,
    });
  }

  const frameDirectory = path.join(
    uploadsRoot,
    "frames",
    video._id.toString()
  );

  await fs.promises.rm(frameDirectory, {
    recursive: true,
    force: true,
  });
};

module.exports = deleteVideoAssets;