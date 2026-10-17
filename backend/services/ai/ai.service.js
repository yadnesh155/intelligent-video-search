const describeImageWithOllama = require("./ollama.service");
const describeImageWithCloudflare = require("./cloudflare.service");

const describeImage = async (imagePath) => {
  const provider = process.env.AI_PROVIDER || "ollama";

  switch (provider) {
    case "ollama":
      return describeImageWithOllama(imagePath);

    case "cloudflare":
      return describeImageWithCloudflare(imagePath);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

module.exports = describeImage;
