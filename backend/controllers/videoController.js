const Video = require("../models/Video");
const Frame = require("../models/Frame");
const AppError = require("../utils/AppError");
const path = require("path");
const cleanupDirectory = require("../utils/cleanupDirectory");
const deleteVideoAssets = require("../utils/deleteVideoAssets");

const processVideo = require("../services/video/videoProcessor");
const { retryFailedFrames } = require("../services/ai/frameAnalyzer");

const uploadVideo = async (req, res) => {
  if (!req.file) {
    throw new AppError("No video file uploaded", 400);
  }

  const video = await Video.create({
    originalName: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    processingStatus: "pending",
  });

  processVideo(video._id).catch((error) => {
    console.error("Background processing error:", error);
  });

  return res.status(201).json({
    success: true,
    message: "Video uploaded successfully",
    video: {
      id: video._id,
      originalName: video.originalName,
      processingStatus: video.processingStatus,
    },
  });
};

const getVideoStatus = async (req, res) => {
  const video = await Video.findById(req.params.id).select(
    "_id originalName processingStatus processingStage processingError totalFrames processedFrames"
  );

  if (!video) {
    throw new AppError("Video not found", 404);
  }

  return res.status(200).json({
    success: true,
    video: {
      id: video._id,
      originalName: video.originalName,
      status: video.processingStatus,
      stage: video.processingStage,
      totalFrames: video.totalFrames,
      processedFrames: video.processedFrames,
      error: video.processingError,
    },
  });
};

const retryFailedVideoFrames = async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new AppError("Video not found", 404);
  }

  if (processVideo.isRunning(video._id) || video.processingStatus === "processing") {
    throw new AppError("Video is already being processed", 409);
  }

  // Include failed frames and any non-completed frame records. The analyzer
  // skips frames that already have valid descriptions + embeddings.
  const framesToRetry = await Frame.find({
    video: video._id,
    $or: [
      { processingStatus: { $ne: "completed" } },
      { description: null },
      { description: "" },
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
    ],
  }).sort({ timestamp: 1 });

  if (framesToRetry.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No unfinished frames to retry",
    });
  }

  const job = processVideo.runManaged(video._id, async () => {
    await Video.findByIdAndUpdate(video._id, {
      processingStatus: "processing",
      processingStage: "analyzing",
      processingError: null,
    });

    return retryFailedFrames(framesToRetry, video._id);
  });

  if (!job.started) {
    throw new AppError("Video is already being processed", 409);
  }

  job.promise.catch(async (error) => {
    console.error("Retry processing error:", error);
    await Video.findByIdAndUpdate(video._id, {
      processingStatus: "failed",
      processingStage: "failed",
      processingError: error.message,
    });
  });

  return res.status(202).json({
    success: true,
    message: "Unfinished frames retry started",
    frameCount: framesToRetry.length,
  });
};

const retryVideoProcessing = async (req, res) => {
  const video = await Video.findOneAndUpdate(
    {
      _id: req.params.id,
      processingStatus: "failed",
    },
    {
      $set: {
        processingStatus: "pending",
        processingStage: "queued",
        processingError: null,
        totalFrames: 0,
        processedFrames: 0,
      },
    },
    { new: true }
  );

  if (!video) {
    const existingVideo = await Video.findById(req.params.id);

    if (!existingVideo) {
      throw new AppError("Video not found", 404);
    }

    if (existingVideo.processingStatus === "processing") {
      throw new AppError("Video is already being processed", 409);
    }

    throw new AppError("Only failed videos can be retried", 400);
  }

  await Frame.deleteMany({ video: video._id });

  const frameDirectory = path.join(
    "uploads",
    "frames",
    video._id.toString()
  );

  await cleanupDirectory(frameDirectory);

  processVideo(video._id).catch((error) => {
    console.error("Retry processing error:", error);
  });

  return res.status(202).json({
    success: true,
    message: "Video processing retry started",
    video: {
      id: video._id,
      originalName: video.originalName,
      processingStatus: "pending",
    },
  });
};

// Recovery endpoint for videos left pending/processing after a backend restart.
// Jobs active in the current Node process are skipped to avoid duplicate analysis.
const resumeUnfinishedVideos = async (req, res) => {
  const videos = await Video.find({
    processingStatus: { $in: ["pending", "processing"] },
  }).select("_id originalName processingStatus");

  let startedCount = 0;
  let alreadyRunningCount = 0;

  for (const video of videos) {
    const job = processVideo.resume(video._id);

    if (job.started) {
      startedCount += 1;
    } else {
      alreadyRunningCount += 1;
    }

    job.promise.catch((error) => {
      console.error(`Resume failed for video ${video._id}:`, error);
    });
  }

  return res.status(202).json({
    success: true,
    startedCount,
    alreadyRunningCount,
    message:
      startedCount > 0
        ? `Resume started for ${startedCount} unfinished video(s). Already-running jobs were left alone.`
        : alreadyRunningCount > 0
          ? "The unfinished videos already have processing jobs running in this backend. No duplicate jobs were started."
          : "No pending or processing videos need recovery.",
  });
};

const deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new AppError("Video not found", 404);
  }

  if (
    processVideo.isRunning(video._id) ||
    video.processingStatus === "processing"
  ) {
    throw new AppError(
      "Cannot delete a video while it is being processed",
      409
    );
  }

  await deleteVideoAssets(video);
  await Frame.deleteMany({ video: video._id });
  await Video.findByIdAndDelete(video._id);

  return res.status(200).json({
    success: true,
    message: "Video deleted successfully",
  });
};

const getVideos = async (req, res) => {
  const videos = await Video.find({})
    .select(
      "_id originalName filename processingStatus processingStage totalFrames processedFrames processingError createdAt"
    )
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.status(200).json({
    success: true,
    count: videos.length,
    videos,
  });
};

module.exports = {
  uploadVideo,
  getVideoStatus,
  retryFailedVideoFrames,
  retryVideoProcessing,
  resumeUnfinishedVideos,
  deleteVideo,
  getVideos,
};
