const describeImageWithCloudflare = require("./cloudflare.service");

const describeImage = async (imagePath) => {
  return describeImageWithCloudflare(imagePath);
};

module.exports = describeImage;