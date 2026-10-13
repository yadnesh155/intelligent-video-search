const express = require("express");

const upload = require("../middleware/upload");
const uploadErrorHandler = require("../middleware/uploadErrorHandler");
const asyncHandler = require("../utils/asyncHandler");

const {
  uploadVideo,
  getVideoStatus,
  retryFailedVideoFrames,
  retryVideoProcessing,
  resumeUnfinishedVideos,
  deleteVideo,
  getVideos,
} = require("../controllers/videoController");

const router = express.Router();

// Upload video
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("video")(req, res, (error) => {
      if (error) {
        return uploadErrorHandler(error, req, res, next);
      }

      next();
    });
  },
  asyncHandler(uploadVideo)
);

// Resume all unfinished videos (pending/stale processing records)
router.post(
  "/resume-unfinished",
  asyncHandler(resumeUnfinishedVideos)
);

// Get processing status
router.get("/:id/status", asyncHandler(getVideoStatus));

// Retry failed/incomplete frames
router.post(
  "/:id/retry-failed",
  asyncHandler(retryFailedVideoFrames)
);

router.post(
  "/:id/retry-processing",
  asyncHandler(retryVideoProcessing)
);

router.delete("/:id", asyncHandler(deleteVideo));

router.get("/", asyncHandler(getVideos));

module.exports = router;
