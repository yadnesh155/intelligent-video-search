const fs = require("fs/promises");
const axios = require("axios");

const describeImageWithCloudflare = async (imagePath) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials are missing");
  }

  const model =
    process.env.CLOUDFLARE_VISION_MODEL || "@cf/llava-hf/llava-1.5-7b-hf";

  const imageBuffer = await fs.readFile(imagePath);

  const url =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/ai/run/${model}`;

  const response = await axios.post(
    url,
    {
      image: Array.from(imageBuffer),
      prompt:
        "Describe this video frame in one concise sentence. " +
        "Identify visible objects, people, actions, and setting. " +
        "Only describe details that are visibly supported.",
      max_tokens: 128,
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    },
  );

  const description = response.data?.result?.description;

  if (typeof description !== "string" || !description.trim()) {
    throw new Error("Cloudflare returned an empty image description");
  }

  return description.trim();
};

module.exports = describeImageWithCloudflare;
