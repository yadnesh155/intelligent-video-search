const axios = require("axios");

const generateEmbedding = async (text) => {
  const response = await axios.post(
    `${process.env.OLLAMA_BASE_URL}/api/embed`,
    {
      model: process.env.EMBEDDING_MODEL,
      input: text,
    }
  );

  return response.data.embeddings[0];
};

module.exports = generateEmbedding;