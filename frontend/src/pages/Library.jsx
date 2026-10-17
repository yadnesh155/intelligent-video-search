import { useCallback, useEffect, useState } from "react";

import api from "../services/api";

const formatStatus = (status) => {
  return status?.replaceAll("_", " ") || "unknown";
};

const formatStage = (stage) => {
  const stages = {
    queued: "Waiting to start",

    extracting: "Extracting frames",

    analyzing: "Analyzing with AI",

    completed: "Processing complete",

    failed: "Processing failed",
  };

  return stages[stage] || "Waiting for status";
};

const Library = () => {
  const [videos, setVideos] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [busyVideoId, setBusyVideoId] = useState(null);

  const [resumingAll, setResumingAll] = useState(false);

  const loadVideos = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get("/videos");

      setVideos(response.data.videos);

      setError("");
    } catch (err) {
      console.error("Failed to load videos:", err);

      setError(
        err.response?.data?.message || "Unable to load your video library.",
      );
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  // Load videos when the page opens

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Automatically refresh while videos are processing

  const hasActiveVideos = videos.some((video) =>
    ["pending", "processing"].includes(video.processingStatus),
  );

  useEffect(() => {
    if (!hasActiveVideos) return;

    const timer = setInterval(() => {
      loadVideos(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [hasActiveVideos, loadVideos]);

  // Resume unfinished videos that no longer have an active backend job.
  const handleResumeUnfinished = async () => {
    try {
      setResumingAll(true);
      setError("");
      setMessage("");

      const response = await api.post("/videos/resume-unfinished");

      setMessage(
        response.data.message || "Recovery started for unfinished videos.",
      );

      await loadVideos(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to resume unfinished videos.",
      );
    } finally {
      setResumingAll(false);
    }
  };

  // Delete a video and all its associated files

  const handleDelete = async (video) => {
    const confirmed = window.confirm(
      `Delete "${video.originalName}" and all its indexed frames?`,
    );

    if (!confirmed) return;

    try {
      setBusyVideoId(video._id);

      setError("");

      setMessage("");

      const response = await api.delete(`/videos/${video._id}`);

      setMessage(response.data.message || "Video deleted successfully.");

      await loadVideos(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete this video.");
    } finally {
      setBusyVideoId(null);
    }
  };

  // Retry the complete processing pipeline

  const handleRetryProcessing = async (video) => {
    try {
      setBusyVideoId(video._id);

      setError("");

      setMessage("");

      const response = await api.post(`/videos/${video._id}/retry-processing`);

      setMessage(response.data.message);

      await loadVideos(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to retry video processing.",
      );
    } finally {
      setBusyVideoId(null);
    }
  };

  // Retry only frames whose AI analysis failed

  const handleRetryFrames = async (video) => {
    try {
      setBusyVideoId(video._id);

      setError("");

      setMessage("");

      const response = await api.post(`/videos/${video._id}/retry-failed`);

      setMessage(response.data.message);

      await loadVideos(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to retry failed frames.");
    } finally {
      setBusyVideoId(null);
    }
  };

  const getProgress = (video) => {
    const totalFrames = Number(video.totalFrames) || 0;
    const processedFrames = Number(video.processedFrames) || 0;

    if (totalFrames <= 0) return 0;

    return Math.min(Math.round((processedFrames / totalFrames) * 100), 100);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Page header */}

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
            Your Library
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            My Videos
          </h1>

          <p className="mt-3 text-slate-400">
            Manage your videos and monitor AI indexing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleResumeUnfinished}
            disabled={resumingAll}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-50"
          >
            {resumingAll ? "Checking videos..." : "Resume unfinished videos"}
          </button>

          <button
            onClick={() => loadVideos(true)}
            disabled={refreshing}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {/* Notifications */}

      {message && (
        <div
          role="status"

          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"

          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {/* Loading */}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
          Loading your video library...
        </div>
      )}

      {/* Empty library */}

      {!loading && !error && videos.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <h2 className="text-xl font-semibold text-white">No videos yet</h2>

          <p className="mt-2 text-sm text-slate-400">
            Upload a video to start building your searchable video library.
          </p>

          <a
            href="/upload"

            className="mt-6 inline-block rounded-xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400"
          >
            Upload a video
          </a>
        </div>
      )}

      {/* Video list */}

      {!loading && videos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Uploaded videos</h2>

            <span className="text-sm text-slate-500">
              {videos.length} videos
            </span>
          </div>

          {videos.map((video) => {
            const status = video.processingStatus;

            const isBusy = busyVideoId === video._id;

            const isActive = ["pending", "processing"].includes(status);

            const canRetryFrames = status === "completed_with_errors";

            const canRetryVideo = status === "failed";

            const canDelete = !isActive;

            const progress = getProgress(video);

            return (
              <article
                key={video._id}

                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  {/* Video information */}

                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold text-white">
                      {video.originalName}
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded {new Date(video.createdAt).toLocaleDateString()}
                    </p>

                    <p className="mt-4 text-sm capitalize text-slate-300">
                      Status:{" "}
                      <span
                        className={
                          status === "completed"
                            ? "text-emerald-400"
                            : status === "failed"
                              ? "text-red-400"
                              : status === "completed_with_errors"
                                ? "text-amber-400"
                                : "text-blue-400"
                        }
                      >
                        {formatStatus(status)}
                      </span>
                    </p>

                    {isActive && video.processingStage && (
                      <p className="mt-2 text-sm text-slate-400">
                        {formatStage(video.processingStage)}
                      </p>
                    )}
                    {/* Always show frame counts, including after completion */}
                    {Number(video.totalFrames) > 0 && (
                      <div className="mt-4 max-w-lg">
                        <div className="mb-2 flex justify-between text-xs text-slate-400">
                          <span>
                            {status === "processing"
                              ? "AI analysis"
                              : "Processed frames"}
                          </span>
                          <span>
                            {Number(video.processedFrames) || 0} /{" "}
                            {video.totalFrames}
                          </span>
                        </div>

                        {/* Show the progress bar only while processing */}
                        {status === "processing" && (
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {video.processingError && (
                      <p className="mt-3 break-words text-sm text-red-400">
                        {video.processingError}
                      </p>
                    )}
                  </div>

                  {/* Actions */}

                  <div className="flex flex-wrap gap-2">
                    {canRetryVideo && (
                      <button
                        onClick={() => handleRetryProcessing(video)}

                        disabled={isBusy}

                        className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50"
                      >
                        {isBusy ? "Starting..." : "Retry processing"}
                      </button>
                    )}

                    {canRetryFrames && (
                      <button
                        onClick={() => handleRetryFrames(video)}

                        disabled={isBusy}

                        className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {isBusy ? "Retrying..." : "Retry failed frames"}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(video)}
                      disabled={isBusy}
                      title={
                        isBusy
                          ? "Please wait"
                          : "Delete video and indexed frames"
                      }
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-500/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default Library;
