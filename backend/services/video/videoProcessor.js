const fs = require("fs");
const path = require("path");

const Video = require("../../models/Video");
const Frame = require("../../models/Frame");
const cleanupDirectory = require("../../utils/cleanupDirectory");

const extractFrames = require("./frameExtractor");
const { analyzeFrames } = require("../ai/frameAnalyzer");

// Tracks jobs running in this Node.js process, preventing duplicate work.
const activeJobs = new Set();

const launchProcessing = (videoId, allowedStatuses) => {
  const id = String(videoId);

  if (activeJobs.has(id)) {
    return {
      started: false,
      reason: "already_running",
      promise: Promise.resolve({ skipped: true, reason: "already_running" }),
    };
  }

  activeJobs.add(id);

  const promise = runProcessing(videoId, allowedStatuses)
    .catch((error) => {
      // runProcessing handles errors after a video has been claimed.
      console.error(`Unexpected background processing error for ${id}:`, error);
    })
    .finally(() => {
      activeJobs.delete(id);
    });

  return { started: true, promise };
};

const runProcessing = async (videoId, allowedStatuses) => {
  let video = null;

  try {
    // Normal uploads claim "pending" videos. Resume can also claim stale
    // "processing" videos; the in-process lock above prevents double work.
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
      const currentVideo = await Video.findById(videoId);

      if (!currentVideo) {
        console.warn(`Cannot process video ${videoId}: video not found.`);
      } else {
        console.log(
          `Skipping video ${currentVideo.originalName}; current status is "${currentVideo.processingStatus}".`
        );
      }

      // Crucially, don't mark a video failed just because another job owns it
      // or its status changed before this worker claimed it.
      return { skipped: true };
    }

    const outputDirectory = path.join(
      "uploads",
      "frames",
      video._id.toString()
    );

    console.log(`Starting/resuming processing for: ${video.originalName}`);

    // Reuse extracted frames whenever their files are still present.
    let savedFrames = await Frame.find({ video: video._id }).sort({
      timestamp: 1,
    });

    const existingFrameFilesAreUsable =
      savedFrames.length > 0 &&
      savedFrames.every((frame) =>
        fs.existsSync(path.resolve(frame.framePath))
      );

    if (!existingFrameFilesAreUsable) {
      await Video.findByIdAndUpdate(video._id, {
        processingStage: "extracting",
      });

      let extractedFrames;

      try {
        extractedFrames = await extractFrames(video.path, outputDirectory);
      } catch (error) {
        await cleanupDirectory(outputDirectory);
        throw error;
      }

      if (!extractedFrames || extractedFrames.length === 0) {
        throw new Error("FFmpeg did not extract any frames from this video.");
      }

      // Upsert by video + timestamp. Existing descriptions and embeddings are
      // preserved, so a resume doesn't throw away successfully analysed work.
      const operations = extractedFrames.map((frame) => ({
        updateOne: {
          filter: {
            video: video._id,
            timestamp: frame.timestamp,
          },
          update: {
            $set: { framePath: frame.path },
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

      const extractedTimestamps = extractedFrames.map((frame) => frame.timestamp);
      await Frame.deleteMany({
        video: video._id,
        timestamp: { $nin: extractedTimestamps },
      });

      savedFrames = await Frame.find({ video: video._id }).sort({
        timestamp: 1,
      });
    } else {
      console.log(
        `Found ${savedFrames.length} saved frames; reusing them and skipping FFmpeg.`
      );
    }

    if (savedFrames.length === 0) {
      throw new Error("No frame records are available for analysis.");
    }

    await Video.findByIdAndUpdate(video._id, {
      totalFrames: savedFrames.length,
      processingStage: "analyzing",
      processingError: null,
    });

    // analyzeFrames skips frames that already have a description and embedding.
    const analysisResult = await analyzeFrames(savedFrames, video._id);

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
      `Processing ${finalStatus} for: ${video.originalName} (${analysisResult.processedCount}/${savedFrames.length} indexed).`
    );

    return { skipped: false, ...analysisResult };
  } catch (error) {
    console.error(
      `Processing failed for video ${videoId}:`,
      error.message
    );

    // Only mark a video failed if this worker successfully claimed it.
    if (video) {
      await Video.findByIdAndUpdate(videoId, {
        processingStatus: "failed",
        processingStage: "failed",
        processingError: error.message,
      });
    } else {
      throw error;
    }

    return { skipped: false, failed: true, error: error.message };
  }
};

// Start a brand-new upload or retry using only the normal pending state.
const processVideo = (videoId) => {
  return launchProcessing(videoId, ["pending"]).promise;
};

// Resume pending/stale processing records. Completed frames are preserved.
processVideo.resume = (videoId) => {
  return launchProcessing(videoId, ["pending", "processing"]);
};

processVideo.runManaged = (videoId, task) => {
  const id = String(videoId);

  if (activeJobs.has(id)) {
    return {
      started: false,
      reason: "already_running",
      promise: Promise.resolve({ skipped: true, reason: "already_running" }),
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

processVideo.isRunning = (videoId) => activeJobs.has(String(videoId));

module.exports = processVideo;
