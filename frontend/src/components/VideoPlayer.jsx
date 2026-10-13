import { useEffect, useRef } from "react";

const VideoPlayer = ({ videoUrl, timestamp }) => {
  const videoRef = useRef(null);
  const previousVideoUrl = useRef(null);

  const fullVideoUrl = `${import.meta.env.VITE_API_URL}${videoUrl}`;

  // JOB 1: Switch the video file only when the URL changes
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    // If it's the same video file, don't reload it!
    if (previousVideoUrl.current === videoUrl) return;

    // Track the new video file name
    previousVideoUrl.current = videoUrl;

    // Load the new file into the player
    videoRef.current.src = fullVideoUrl;
    videoRef.current.load();

    // Wait for the video to load, then jump to the initial timestamp
    const handleMetadataLoaded = () => {
      videoRef.current.currentTime = timestamp || 0;
    };

    videoRef.current.addEventListener("loadedmetadata", handleMetadataLoaded, { once: true });
  }, [videoUrl]); // Only runs when videoUrl changes

  // JOB 2: Fast-jump timestamps if the video is already loaded
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    // If the video is already playing, just instantly snap to the new time
    if (previousVideoUrl.current === videoUrl && videoRef.current.readyState >= 1) {
      videoRef.current.currentTime = timestamp || 0;
    }
  }, [timestamp]); // Only runs when timestamp changes

  return (
    <video
      ref={videoRef}
      controls
      width="800"
    />
  );
};

export default VideoPlayer;
