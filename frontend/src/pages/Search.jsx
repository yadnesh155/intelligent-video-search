import { useMemo, useState } from "react";
import api from "../services/api";
import VideoPlayer from "../components/VideoPlayer";
import formatTimestamp from "../utils/formatTimestamp";
const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const groupedResults = useMemo(() => {
    const groups = new Map();
    results.forEach((result) => {
      if (!groups.has(result.videoId)) {
        groups.set(result.videoId, {
          videoId: result.videoId,
          videoName: result.videoName,
          videoUrl: result.videoUrl,
          matches: [],
        });
      }
      groups.get(result.videoId).matches.push(result);
    });
    return Array.from(groups.values());
  }, [results]);
  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setSelectedResult(null);
      setError("Enter something to search.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSelectedResult(null);
      const response = await api.get("/search", {
        params: { q: trimmedQuery },
      });
      setResults(response.data.results);
      if (response.data.results.length === 0) {
        setError(`No moments found for "${trimmedQuery}".`);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
      setSelectedResult(null);
      setError(
        err.response?.data?.message || "Search failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  const handleResultClick = (result) => {
    console.log("Selected video:", result.videoName);
    console.log("Selected timestamp:", result.timestamp);

    setSelectedResult(result);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="space-y-10">
      {" "}
      {/* Header */}{" "}
      <section className="mx-auto max-w-3xl text-center">
        {" "}
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">
          {" "}
          AI-Powered Video Search{" "}
        </p>{" "}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {" "}
          Find any moment in your videos.{" "}
        </h1>{" "}
        <p className="mt-4 text-slate-400">
          {" "}
          Search your indexed videos using natural language and jump directly to
          the matching moment.{" "}
        </p>{" "}
        <form
          onSubmit={handleSearch}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          {" "}
          <input
            type="text"
            placeholder='Try "someone scoring a goal"...'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
          />{" "}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {" "}
            {loading ? "Searching..." : "Search"}{" "}
          </button>{" "}
        </form>{" "}
      </section>{" "}
      {/* Selected Video */}{" "}
      {selectedResult && (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          {" "}
          <div className="aspect-video bg-black">
            {" "}
            <VideoPlayer
              videoUrl={selectedResult.videoUrl}
              timestamp={selectedResult.timestamp}
            />{" "}
          </div>{" "}
          <div className="border-t border-slate-800 p-5">
            {" "}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {" "}
              <h2 className="font-semibold text-white">
                {" "}
                {selectedResult.videoName}{" "}
              </h2>{" "}
              <span className="w-fit rounded-lg bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
                {" "}
                {formatTimestamp(selectedResult.timestamp)}{" "}
              </span>{" "}
            </div>{" "}
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {" "}
              {selectedResult.description}{" "}
            </p>{" "}
          </div>{" "}
        </section>
      )}{" "}
      {/* Search Status */}{" "}
      {loading && (
        <div className="flex justify-center">
          {" "}
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm text-slate-400">
            {" "}
            Searching your indexed videos...{" "}
          </div>{" "}
        </div>
      )}{" "}
      {!loading && error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
          {" "}
          <p className="text-sm text-slate-400"> {error} </p>{" "}
        </div>
      )}{" "}
      {/* Results */}{" "}
      {!loading && groupedResults.length > 0 && (
        <section>
          {" "}
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {" "}
            <div>
              {" "}
              <h2 className="text-xl font-semibold text-white">
                {" "}
                Search results{" "}
              </h2>{" "}
              <p className="mt-1 text-sm text-slate-500">
                {" "}
                Results for "{query}"{" "}
              </p>{" "}
            </div>{" "}
            <span className="text-sm text-slate-500">
              {" "}
              {groupedResults.length} videos · {results.length} moments{" "}
            </span>{" "}
          </div>{" "}
          <div className="space-y-6">
            {" "}
            {groupedResults.map((video) => (
              <div
                key={video.videoId}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
              >
                {" "}
                {/* Video Heading */}{" "}
                <div className="border-b border-slate-800 px-5 py-4">
                  {" "}
                  <h3 className="font-semibold text-white">
                    {" "}
                    {video.videoName}{" "}
                  </h3>{" "}
                  <p className="mt-1 text-sm text-slate-500">
                    {" "}
                    {video.matches.length} matching{" "}
                    {video.matches.length === 1 ? "moment" : "moments"}{" "}
                  </p>{" "}
                </div>{" "}
                {/* Moments */}{" "}
                <div className="divide-y divide-slate-800">
                  {" "}
                  {video.matches.map((result) => {
                    const isSelected =
                      selectedResult?.frameId === result.frameId;
                    return (
                      <button
                        key={result.frameId}
                        onClick={() => handleResultClick(result)}
                        className={`flex w-full gap-4 p-4 text-left transition ${isSelected ? "bg-blue-500/10" : "hover:bg-slate-800"}`}
                      >
                        {" "}
                        <img
                          src={
                            result.frameUrl
                              ? /^https?:\/\//i.test(result.frameUrl)
                                ? result.frameUrl
                                : `${import.meta.env.VITE_API_URL}${result.frameUrl}`
                              : ""
                          }
                          alt={`Video frame at ${formatTimestamp(result.timestamp)}`}
                          loading="lazy"
                          className="h-24 w-40 shrink-0 rounded-lg object-cover"
                        />{" "}
                        <div className="min-w-0 flex-1">
                          {" "}
                          <div className="flex items-start justify-between gap-4">
                            {" "}
                            <p className="text-sm leading-6 text-slate-300">
                              {" "}
                              {result.description}{" "}
                            </p>{" "}
                            <span
                              className={`shrink-0 rounded-lg px-3 py-1 text-sm font-medium ${isSelected ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-400"}`}
                            >
                              {" "}
                              {formatTimestamp(result.timestamp)}{" "}
                            </span>{" "}
                          </div>{" "}
                          <p className="mt-2 text-xs text-slate-500">
                            {" "}
                            Click to jump to this moment{" "}
                          </p>{" "}
                        </div>{" "}
                      </button>
                    );
                  })}{" "}
                </div>{" "}
              </div>
            ))}{" "}
          </div>{" "}
        </section>
      )}{" "}
      {/* Initial state */}{" "}
      {!loading && !error && results.length === 0 && (
        <div className="py-16 text-center">
          {" "}
          <p className="text-lg font-medium text-slate-300">
            {" "}
            Search your video library{" "}
          </p>{" "}
          <p className="mt-2 text-sm text-slate-500">
            {" "}
            Try searching for people, objects, actions, places, or scenes.{" "}
          </p>{" "}
        </div>
      )}{" "}
    </div>
  );
};
export default Search;
