const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const extractFrames = async (videoPath, outputDirectory) => {
  await fs.promises.mkdir(outputDirectory, {
    recursive: true,
  });

  const outputPattern = path.join(
    outputDirectory,
    "frame-%06d.jpg"
  );

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-vf",
      "fps=1/3",
      "-q:v",
      "2",
      outputPattern,
    ]);

    let errorOutput = "";

    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(
        new Error(`Failed to start FFmpeg: ${error.message}`)
      );
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `FFmpeg failed with code ${code}\n${errorOutput}`
          )
        );
      }

      try {
        const files = await fs.promises.readdir(outputDirectory);

        const frameFiles = files
          .filter((file) => file.endsWith(".jpg"))
          .sort();

        const frames = frameFiles.map((file, index) => ({
          filename: file,
          path: path.join(outputDirectory, file),
          timestamp: index * 3,
        }));

        resolve(frames);
      } catch (error) {
        reject(error);
      }
    });
  });
};

module.exports = extractFrames;