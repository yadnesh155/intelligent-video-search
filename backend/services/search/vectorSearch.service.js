
const Frame = require("../../models/Frame");
const Video = require("../../models/Video");
const generateEmbedding = require("../ai/embedding.service");

const RESULT_LIMIT = 20;
const RRF_K = 60;

const VECTOR_SCORE_THRESHOLD = Number(
  process.env.VECTOR_SCORE_THRESHOLD || 0.70
);

const searchByMeaning = async (
  query,
  limit = RESULT_LIMIT
) => {
  const queryEmbedding = await generateEmbedding(query);

  // Run semantic and keyword search in parallel
  const [vectorResults, textResults] = await Promise.all([
    runVectorSearch(queryEmbedding, limit),
    runTextSearch(query, limit),
  ]);

  // Combine both ranked result lists
  const combinedResults = combineResults(
    vectorResults,
    textResults,
    limit
  );

  // Add video names and playable URLs
  return attachVideoInformation(combinedResults);
};

const runVectorSearch = async (queryEmbedding, limit) => {
  return Frame.aggregate([
    {
      $vectorSearch: {
        index: "frame_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        video: 1,
        framePath: 1,
        timestamp: 1,
        description: 1,
        processingStatus: 1,
        vectorScore: {
          $meta: "vectorSearchScore",
        },
      },
    },
    {
      $match: {
        vectorScore: {
          $gte: VECTOR_SCORE_THRESHOLD,
        },
        description: {
          $exists: true,
          $nin: [null, "", "Pending AI analysis"],
        },
        // Also allow older valid documents without this field.
        processingStatus: {
          $in: ["completed", null],
        },
      },
    },
  ]);
};

const runTextSearch = async (query, limit) => {
  return Frame.find(
    {
      $text: {
        $search: query,
      },
      description: {
        $exists: true,
        $nin: [null, "", "Pending AI analysis"],
      },
      processingStatus: {
        $in: ["completed", null],
      },
    },
    {
      score: {
        $meta: "textScore",
      },
    }
  )
    .sort({
      score: {
        $meta: "textScore",
      },
    })
    .limit(limit)
    .lean();
};

const combineResults = (
  vectorResults,
  textResults,
  limit
) => {
  const resultMap = new Map();

  // Add semantic-search rankings
  vectorResults.forEach((result, index) => {
    const id = result._id.toString();

    resultMap.set(id, {
      ...result,
      vectorScore: result.vectorScore,
      textScore: 0,
      rrfScore: 1 / (RRF_K + index + 1),
    });
  });

  // Add keyword-search rankings
  textResults.forEach((result, index) => {
    const id = result._id.toString();
    const existing = resultMap.get(id);

    const textContribution =
      1 / (RRF_K + index + 1);

    if (existing) {
      existing.textScore = result.score;
      existing.rrfScore += textContribution;
    } else {
      resultMap.set(id, {
        ...result,
        vectorScore: 0,
        textScore: result.score,
        rrfScore: textContribution,
      });
    }
  });

  return Array.from(resultMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
};

const attachVideoInformation = async (results) => {
  const videoIds = [
    ...new Set(
      results
        .filter((result) => result.video)
        .map((result) => result.video.toString())
    ),
  ];

  const videos = await Video.find({
    _id: {
      $in: videoIds,
    },
  })
    .select("_id originalName filename")
    .lean();

  const videoMap = new Map(
    videos.map((video) => [
      video._id.toString(),
      video,
    ])
  );

  return results.map((result) => {
    const video = result.video
      ? videoMap.get(result.video.toString())
      : null;

    return {
      frameId: result._id,
      videoId: video?._id || null,
      videoName: video?.originalName || null,
      videoUrl: video
        ? `/uploads/videos/${video.filename}`
        : null,
      frameUrl: result.framePath
        ? `/${result.framePath.replace(/\\/g, "/")}`
        : null,
      timestamp: result.timestamp,
      description: result.description,
      vectorScore: result.vectorScore || 0,
      textScore: result.textScore || 0,
      rrfScore: result.rrfScore,
    };
  });
};

module.exports = searchByMeaning;
