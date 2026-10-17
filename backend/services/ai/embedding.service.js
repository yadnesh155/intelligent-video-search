const axios = require("axios");

const generateEmbedding = async (text) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const model =
    process.env.CLOUDFLARE_EMBEDDING_MODEL || "@cf/google/embeddinggemma-300m";

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Account ID or API token is missing");
  }

  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string");
  }

  const url =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/ai/run/${model}`;

  const response = await axios.post(
    url,
    { text: [text] },
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    },
  );

  const embedding = response.data?.result?.data?.[0];

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Cloudflare returned an invalid embedding");
  }

  if (embedding.length !== 768) {
    throw new Error(
      `Expected a 768-dimensional embedding, received ${embedding.length}`,
    );
  }

  return embedding;
};

module.exports = generateEmbedding;
