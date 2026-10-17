const fs = require("fs");
const path = require("path");

const Video = require("../../models/Video");
const Frame = require("../../models/Frame");
const cleanupDirectory = require("../../utils/cleanupDirectory");

const extractFrames = require("./frameExtractor");
const { analyzeFrames } = require("../ai/frameAnalyzer");

const {
  uploadLocalFile,
  downloadToFile,
} = require("../storage/supabaseStorage.service");

const activeJobs = new Set();

const localPathFor = (storedPath) => path.resolve(storedPath);

const ensureLocalVideo = async (video) => {
  const localVideoPath = localPathFor(video.path);

  if (fs.existsSync(localVideoPath)) {
    return localVideoPath;
  }

  if (!video.storagePath) {
    throw new Error(
      "Local video is missing and no Supabase storage path exists."
    );
  }

  await fs.promises.mkdir(path.dirname(localVideoPath), {
    recursive: true,
  });

  await downloadToFile(video.storagePath, localVideoPath);

  return localVideoPath;
};

const restoreLocalFrames = async (frames) => {
  for (const frame of frames) {
    const localFramePath = localPathFor(frame.framePath);

    if (fs.existsSync(localFramePath)) {
      continue;
    }

    if (!frame.storagePath) {
      return false;
    }

    try {
      await fs.promises.mkdir(path.dirname(localFramePath), {
        recursive: true,
      });

      await downloadToFile(
        frame.storagePath,
        localFramePath
      );
    } catch (error) {
      console.warn(
        `Could not restore frame at ${frame.timestamp}s:`,
        error.message
      );

      return false;
    }
  }

  return (
    frames.length > 0 &&
    frames.every((frame) =>
      fs.existsSync(localPathFor(frame.framePath))
    )
  );
};

const launchProcessing = (videoId, allowedStatuses) => {
  const id = String(videoId);

  if (activeJobs.has(id)) {
    return {
      started: false,
      reason: "already_running",
      promise: Promise.resolve({
        skipped: true,
        reason: "already_running",
      }),
    };
  }

  activeJobs.add(id);

  const promise = runProcessing(videoId, allowedStatuses)
    .catch((error) => {
      console.error(
        `Unexpected background processing error for ${id}:`,
        error
      );
    })
    .finally(() => {
      activeJobs.delete(id);
    });

  return { started: true, promise };
};

const runProcessing = async (videoId, allowedStatuses) => {
  let video = null;

  try {
    video = await Video.findOneAndUpdate(
      {
        _id: videoId,
        processingStatus: { $in: allowedStatuses },
      },
      {
        $set: {
          processingStatus: "processing",
          processingStage: "extracting",
          processingError: null,
        },
      },
      { new: true }
    );

    if (!video) {
      console.log(`Skipping video ${videoId}; it cannot be claimed.`);
      return { skipped: true };
    }

    const outputDirectory = path.join(
      "uploads",
      "frames",
      video._id.toString()
    );

    console.log(
      `Starting/resuming processing for: ${video.originalName}`
    );

    const localVideoPath = await ensureLocalVideo(video);

    let savedFrames = await Frame.find({
      video: video._id,
    }).sort({ timestamp: 1 });

    const framesAvailable = await restoreLocalFrames(savedFrames);

    if (!framesAvailable) {
      await Video.findByIdAndUpdate(video._id, {
        processingStage: "extracting",
      });

      let extractedFrames;

      try {
        extractedFrames = await extractFrames(
          localVideoPath,
          outputDirectory
        );
      } catch (error) {
        await cleanupDirectory(outputDirectory);
        throw error;
      }

      if (!extractedFrames?.length) {
        throw new Error("FFmpeg did not extract any frames.");
      }

      const framesWithStorage = [];

      for (let i = 0; i < extractedFrames.length; i += 1) {
        const frame = extractedFrames[i];

        const objectPath =
          `frames/${video._id}/${path.basename(frame.path)}`;

        const storagePath = await uploadLocalFile(
          frame.path,
          objectPath,
          "image/jpeg"
        );

        framesWithStorage.push({
          ...frame,
          storagePath,
        });

        console.log(
          `Stored frame ${i + 1}/${extractedFrames.length} in Supabase.`
        );
      }

      const operations = framesWithStorage.map((frame) => ({
        updateOne: {
          filter: {
            video: video._id,
            timestamp: frame.timestamp,
          },
          update: {
            $set: {
              framePath: frame.path,
              storagePath: frame.storagePath,
            },
            $setOnInsert: {
              video: video._id,
              timestamp: frame.timestamp,
              description: null,
              keywords: [],
              embedding: [],
              processingStatus: "pending",
              processingError: null,
            },
          },
          upsert: true,
        },
      }));

      await Frame.bulkWrite(operations, { ordered: false });

      const timestamps = framesWithStorage.map(
        (frame) => frame.timestamp
      );

      await Frame.deleteMany({
        video: video._id,
        timestamp: { $nin: timestamps },
      });

      savedFrames = await Frame.find({
        video: video._id,
      }).sort({ timestamp: 1 });
    } else {
      console.log(
        `Reusing ${savedFrames.length} existing frames.`
      );
    }

    if (!savedFrames.length) {
      throw new Error("No frame records are available for analysis.");
    }

    await Video.findByIdAndUpdate(video._id, {
      totalFrames: savedFrames.length,
      processingStage: "analyzing",
      processingError: null,
    });

    const analysisResult = await analyzeFrames(
      savedFrames,
      video._id
    );

    const finalStatus =
      analysisResult.failedCount > 0
        ? "completed_with_errors"
        : "completed";

    await Video.findByIdAndUpdate(video._id, {
      processingStatus: finalStatus,
      processingStage: "completed",
      totalFrames: savedFrames.length,
      processedFrames: analysisResult.processedCount,
      processingError:
        analysisResult.failedCount > 0
          ? `${analysisResult.failedCount} frame(s) still need analysis.`
          : null,
    });

    console.log(
      `Processing ${finalStatus} for ${video.originalName}.`
    );

    return {
      skipped: false,
      ...analysisResult,
    };
  } catch (error) {
    console.error(
      `Processing failed for video ${videoId}:`,
      error.message
    );

    if (video) {
      await Video.findByIdAndUpdate(videoId, {
        processingStatus: "failed",
        processingStage: "failed",
        processingError: error.message,
      });
    } else {
      throw error;
    }

    return {
      skipped: false,
      failed: true,
      error: error.message,
    };
  }
};

const processVideo = (videoId) =>
  launchProcessing(videoId, ["pending"]).promise;

processVideo.resume = (videoId) =>
  launchProcessing(videoId, ["pending", "processing"]);

processVideo.runManaged = (videoId, task) => {
  const id = String(videoId);

  if (activeJobs.has(id)) {
    return {
      started: false,
      reason: "already_running",
      promise: Promise.resolve({ skipped: true }),
    };
  }

  activeJobs.add(id);

  const promise = Promise.resolve()
    .then(task)
    .finally(() => {
      activeJobs.delete(id);
    });

  return { started: true, promise };
};

processVideo.isRunning = (videoId) =>
  activeJobs.has(String(videoId));

module.exports = processVideo;