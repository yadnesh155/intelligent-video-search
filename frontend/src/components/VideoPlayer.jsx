import { useEffect, useRef } from "react";

const VideoPlayer = ({ videoUrl, timestamp }) => {
  const videoRef = useRef(null);
  const currentTimestamp = useRef(timestamp);

  useEffect(() => {
    currentTimestamp.current = timestamp;
  }, [timestamp]);

  // Seek to the selected timestamp and attempt playback.
  const seekAndPlay = (video, target) => {
    try {
      video.currentTime = Math.max(0, Number(target) || 0);

      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Automatic playback was blocked by the browser:", error);
        });
      }
    } catch (error) {
      console.error("Unable to seek or play video:", error);
    }
  };

  // Load the selected video and seek after metadata is ready.
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl) return;

    const fullVideoUrl = /^https?:\/\//i.test(videoUrl)
      ? videoUrl
      : `${import.meta.env.VITE_API_URL}${videoUrl}`;

    let cancelled = false;

    const handleLoadedMetadata = () => {
      if (cancelled) return;
      seekAndPlay(video, currentTimestamp.current);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, {
      once: true,
    });

    // Avoid unnecessary reloads when the same video is selected.
    if (video.getAttribute("src") !== fullVideoUrl) {
      video.src = fullVideoUrl;
      video.load();
    } else if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [videoUrl]);

  // Seek and attempt playback when another timestamp is selected.
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoUrl || video.readyState < 1) return;

    seekAndPlay(video, timestamp);
  }, [timestamp, videoUrl]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      className="block h-full w-full max-w-full bg-black object-contain"
    />
  );
};

export default VideoPlayer;
