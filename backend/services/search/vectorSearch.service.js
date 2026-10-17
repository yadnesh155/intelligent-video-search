const Frame = require("../../models/Frame");
const Video = require("../../models/Video");
const generateEmbedding = require("../ai/embedding.service");

const {
  createSignedUrl,
} = require("../storage/supabaseStorage.service");

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

  const [vectorResults, textResults] = await Promise.all([
    runVectorSearch(queryEmbedding, limit),
    runTextSearch(query, limit),
  ]);

  const combinedResults = combineResults(
    vectorResults,
    textResults,
    limit
  );

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
        storagePath: 1,
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

  vectorResults.forEach((result, index) => {
    const id = result._id.toString();

    resultMap.set(id, {
      ...result,
      vectorScore: result.vectorScore,
      textScore: 0,
      rrfScore: 1 / (RRF_K + index + 1),
    });
  });

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
    .select("_id originalName filename storagePath")
    .lean();

  const videoMap = new Map(
    videos.map((video) => [
      video._id.toString(),
      video,
    ])
  );

  // Generate one signed URL per video, even if multiple
  // search results refer to the same video.
  const videoUrlPromises = new Map();

  for (const video of videos) {
    const id = video._id.toString();

    if (video.storagePath) {
      videoUrlPromises.set(
        id,
        createSignedUrl(video.storagePath, 3600).catch(
          (error) => {
            console.error(
              `Could not create video URL for ${video.originalName}:`,
              error.message
            );
            return null;
          }
        )
      );
    } else {
      // Compatibility with older videos stored locally.
      videoUrlPromises.set(
        id,
        Promise.resolve(
          `/uploads/videos/${video.filename}`
        )
      );
    }
  }

  const frameUrlPromises = results.map((result) => {
    if (result.storagePath) {
      return createSignedUrl(
        result.storagePath,
        3600
      ).catch((error) => {
        console.error(
          `Could not create frame URL for ${result._id}:`,
          error.message
        );
        return null;
      });
    }

    // Compatibility with existing local frames.
    return Promise.resolve(
      result.framePath
        ? `/${result.framePath.replace(/\\/g, "/")}`
        : null
    );
  });

  const frameUrls = await Promise.all(frameUrlPromises);

  return Promise.all(
    results.map(async (result, index) => {
      const video = result.video
        ? videoMap.get(result.video.toString())
        : null;

      const videoUrl = video
        ? await videoUrlPromises.get(video._id.toString())
        : null;

      return {
        frameId: result._id,
        videoId: video?._id || null,
        videoName: video?.originalName || null,
        videoUrl,
        frameUrl: frameUrls[index],
        timestamp: result.timestamp,
        description: result.description,
        vectorScore: result.vectorScore || 0,
        textScore: result.textScore || 0,
        rrfScore: result.rrfScore,
      };
    })
  );
};

module.exports = searchByMeaning;