const Frame = require("../../models/Frame");
const Video = require("../../models/Video");
const describeImage = require("./ai.service");
const generateEmbedding = require("./embedding.service");

const hasDescription = (frame) =>
  typeof frame.description === "string" &&
  frame.description.trim().length > 0;

const hasEmbedding = (frame) =>
  Array.isArray(frame.embedding) && frame.embedding.length > 0;

const isIndexed = (frame) =>
  frame.processingStatus === "completed" &&
  hasDescription(frame) &&
  hasEmbedding(frame);

const countIndexedFrames = async (videoId) => {
  const frames = await Frame.find({ video: videoId })
    .select("processingStatus description embedding")
    .lean();

  return frames.filter(isIndexed).length;
};

const analyzeFrames = async (frames, videoId) => {
  // Count previously indexed frames first so progress remains cumulative
  // when a processing job is resumed.
  let processedCount = await countIndexedFrames(videoId);

  await Video.findByIdAndUpdate(videoId, {
    processedFrames: processedCount,
  });

  for (const frame of frames) {
    // Don't call the vision model again for a frame already fully indexed.
    if (isIndexed(frame)) {
      continue;
    }

    try {
      console.log(`Starting analysis for frame at ${frame.timestamp}s...`);

      await Frame.findByIdAndUpdate(frame._id, {
        processingStatus: "processing",
        processingError: null,
      });

      // If a description survived a previous attempt but its embedding didn't,
      // generate only the missing embedding rather than describing the image again.
      let description = hasDescription(frame)
        ? frame.description.trim()
        : await describeImage(frame.framePath);

      let embedding = hasEmbedding(frame)
        ? frame.embedding
        : await generateEmbedding(description);

      if (!description || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("AI analysis did not return a description and embedding.");
      }

      await Frame.findByIdAndUpdate(frame._id, {
        description,
        embedding,
        processingStatus: "completed",
        processingError: null,
      });

      processedCount += 1;

      await Video.findByIdAndUpdate(videoId, {
        processedFrames: processedCount,
      });

      console.log(
        `Frame indexed: ${processedCount} processed frames so far.`
      );
    } catch (error) {
      await Frame.findByIdAndUpdate(frame._id, {
        processingStatus: "failed",
        processingError: error.message,
      });

      console.error(
        `Frame at ${frame.timestamp}s failed:`,
        error.message
      );
    }
  }

  const remainingFrames = await Frame.find({ video: videoId })
    .select("processingStatus description embedding")
    .lean();

  const finalProcessedCount = remainingFrames.filter(isIndexed).length;
  const failedCount = remainingFrames.length - finalProcessedCount;

  await Video.findByIdAndUpdate(videoId, {
    totalFrames: remainingFrames.length,
    processedFrames: finalProcessedCount,
  });

  return {
    processedCount: finalProcessedCount,
    failedCount,
  };
};

const retryFailedFrames = async (frames, videoId) => {
  const beforeCount = await countIndexedFrames(videoId);
  const result = await analyzeFrames(frames, videoId);
  const retrySuccessCount = Math.max(0, result.processedCount - beforeCount);

  const finalStatus =
    result.failedCount > 0 ? "completed_with_errors" : "completed";

  await Video.findByIdAndUpdate(videoId, {
    processingStatus: finalStatus,
    processingStage: "completed",
    processingError:
      result.failedCount > 0
        ? `${result.failedCount} frame(s) still need analysis.`
        : null,
    totalFrames: await Frame.countDocuments({ video: videoId }),
    processedFrames: result.processedCount,
  });

  return {
    retrySuccessCount,
    retryFailedCount: result.failedCount,
    failedFramesRemaining: result.failedCount,
  };
};

module.exports = {
  analyzeFrames,
  retryFailedFrames,
};
