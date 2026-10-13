const describeImageWithOllama = require("./ollama.service");

const describeImage = async (imagePath) => {
  const provider = process.env.AI_PROVIDER;

  switch (provider) {
    case "ollama":
      return describeImageWithOllama(imagePath);

    default:
      throw new Error(
        `Unsupported AI provider: ${provider}`
      );
  }
};

module.exports = describeImage;