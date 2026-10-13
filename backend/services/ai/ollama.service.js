const fs = require("fs");
const axios = require("axios");

const describeImage = async (imagePath) => {
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await axios.post(
        `${process.env.OLLAMA_BASE_URL}/api/generate`,
        {
            model: process.env.OLLAMA_MODEL,
            prompt: 
                "Describe this image clearly and concisely. Focus on the people, objects, actions, setting and other visually important details. Do not mention that you are an AI.",
            images: [base64Image],
            stream: false,
        }
    );

    return response.data.response;
};

module.exports = describeImage;