import {
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../services/api";

const MAX_FILE_SIZE = 500 * 1024 * 1024;

const formatFileSize = (bytes) => {
  if (!bytes) return "0 MB";

  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(1)} MB`;
};

const Upload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [stage, setStage] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [totalFrames, setTotalFrames] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);

  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    setMessage("");
    setStatus(null);
    setStage(null);
    setVideoId(null);
    setTotalFrames(0);
    setProcessedFrames(0);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setFile(null);
      setMessage("Please select a valid video file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setMessage("Video must be smaller than 500 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const checkProcessingStatus = async (id) => {
    try {
      const response = await api.get(
        `/videos/${id}/status`
      );

      const video = response.data.video;
      const currentStatus = video.status;
      const currentStage = video.stage;

      setStatus(currentStatus);
      setStage(currentStage);

      setTotalFrames(video.totalFrames || 0);
      setProcessedFrames(video.processedFrames || 0);

      if (currentStatus === "completed") {
        setMessage(
          "Your video is ready to search."
        );
        return;
      }

      if (
        currentStatus === "completed_with_errors"
      ) {
        setMessage(
          "Indexing completed, but some frames could not be analyzed."
        );
        return;
      }

      if (currentStatus === "failed") {
        setMessage(
          video.error ||
            "Video processing failed."
        );
        return;
      }

      timeoutRef.current = setTimeout(() => {
        checkProcessingStatus(id);
      }, 2000);
    } catch (error) {
      console.error(
        "Status check failed:",
        error
      );

      setMessage(
        "Unable to check processing status."
      );
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a video.");
      return;
    }

    try {
      setIsUploading(true);

      setStatus("uploading");
      setStage("queued");
      setVideoId(null);
      setMessage("Uploading your video...");
      setTotalFrames(0);
      setProcessedFrames(0);

      const formData = new FormData();

      formData.append("video", file);

      const response = await api.post(
        "/videos/upload",
        formData
      );

      const id = response.data.video.id;

      setVideoId(id);
      setStatus(
        response.data.video.processingStatus
      );

      setStage("queued");

      setMessage(
        "Upload complete. Video processing started."
      );

      checkProcessingStatus(id);
    } catch (error) {
      console.error(
        "Upload failed:",
        error
      );

      setStatus("failed");
      setStage("failed");

      setMessage(
        error.response?.data?.message ||
          "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const progressPercentage =
    totalFrames > 0
      ? Math.min(
          (processedFrames / totalFrames) * 100,
          100
        )
      : 0;

  const getStageMessage = () => {
    switch (stage) {
      case "queued":
        return "Waiting to start processing...";

      case "extracting":
        return "Extracting frames from your video...";

      case "analyzing":
        return "Analyzing frames with AI...";

      case "completed":
        return "Processing completed.";

      case "failed":
        return "Processing failed.";

      default:
        return "";
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
          Video Indexing
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Upload a video
        </h1>

        <p className="mt-4 text-slate-400">
          We'll extract frames, analyze them with AI,
          and make your video searchable.
        </p>
      </div>

      {/* Upload Card */}
      <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <label className="mb-3 block text-sm font-medium text-slate-300">
          Choose a video
        </label>

        <input
          type="file"
          accept=".mp4,.webm,.mov,.mpeg"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full cursor-pointer text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-blue-400 disabled:cursor-not-allowed"
        />

        {file && (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="truncate text-sm font-medium text-white">
              {file.name}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isUploading || !file}
          className="mt-6 w-full rounded-xl bg-blue-500 px-6 py-3 font-medium transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading
            ? "Uploading..."
            : "Upload & Index Video"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-300">
            {message}
          </p>
        </div>
      )}

      {/* Processing Status */}
      {status &&
        status !== "uploading" &&
        status !== "failed" && (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Processing status
                </p>

                <p className="mt-1 text-lg font-semibold capitalize text-white">
                  {status.replaceAll("_", " ")}
                </p>
              </div>

              {status === "completed" && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  Ready
                </span>
              )}

              {status ===
                "completed_with_errors" && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  Partial
                </span>
              )}
            </div>

            {/* Current Stage */}
            {stage && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-300">
                  {getStageMessage()}
                </p>
              </div>
            )}

            {/* AI Progress */}
            {totalFrames > 0 &&
              stage === "analyzing" && (
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">
                      AI analysis
                    </span>

                    <span className="text-slate-300">
                      {processedFrames} /{" "}
                      {totalFrames}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{
                        width: `${progressPercentage}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {Math.round(
                      progressPercentage
                    )}
                    % analyzed
                  </p>
                </div>
              )}
          </div>
        )}

      {/* Error State */}
      {status === "failed" && (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="font-medium text-red-400">
            Something went wrong
          </p>

          <p className="mt-1 text-sm text-slate-400">
            {message}
          </p>
        </div>
      )}

      {/* Video ID */}
      {videoId && (
        <p className="mt-4 text-center text-xs text-slate-600">
          Video ID: {videoId}
        </p>
      )}
    </div>
  );
};

export default Upload;
