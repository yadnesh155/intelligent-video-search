const axios = require("axios");

const generateEmbeddingWithOllama = async (text) => {
  const response = await axios.post(
    `${process.env.OLLAMA_BASE_URL}/api/embed`,
    {
      model: process.env.EMBEDDING_MODEL,
      input: text,
    }
  );

  return response.data.embeddings[0];
};

const generateEmbeddingWithCloudflare = async (text) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model =
    process.env.CLOUDFLARE_EMBEDDING_MODEL ||
    "@cf/google/embeddinggemma-300m";

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare Account ID or API token is missing"
    );
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
    }
  );

  const embedding = response.data?.result?.data?.[0];

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      "Cloudflare returned an invalid embedding"
    );
  }

  return embedding;
};

const generateEmbedding = async (text) => {
  const provider =
    process.env.EMBEDDING_PROVIDER || "ollama";

  switch (provider) {
    case "ollama":
      return generateEmbeddingWithOllama(text);

    case "cloudflare":
      return generateEmbeddingWithCloudflare(text);

    default:
      throw new Error(
        `Unsupported embedding provider: ${provider}`
      );
  }
};

module.exports = generateEmbedding;