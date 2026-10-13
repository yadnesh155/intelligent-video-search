const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const uploadsRoot = path.resolve(
  backendRoot,
  "uploads"
);

const getSafeUploadPath = (relativePath) => {
  const absolutePath = path.resolve(
    backendRoot,
    relativePath
  );

  const isInsideUploads =
    absolutePath === uploadsRoot ||
    absolutePath.startsWith(
      `${uploadsRoot}${path.sep}`
    );

  if (!isInsideUploads) {
    throw new Error(
      "Invalid upload path detected."
    );
  }

  return absolutePath;
};

const deleteVideoAssets = async (video) => {
  const videoFilePath = getSafeUploadPath(
    video.path
  );

  const frameDirectory = path.join(
    uploadsRoot,
    "frames",
    video._id.toString()
  );

  await fs.promises.rm(videoFilePath, {
    force: true,
  });

  await fs.promises.rm(frameDirectory, {
    recursive: true,
    force: true,
  });
};

module.exports = deleteVideoAssets;