require("dotenv").config();

const mongoose = require("mongoose");

const Frame = require("../models/Frame");
const generateEmbedding = require("../services/ai/embedding.service");

const backfillEmbeddings = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected.");

    const frames = await Frame.find({
      description: {
        $exists: true,
        $ne: null,
      },
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
      ],
    });

    console.log(
      `Found ${frames.length} frames requiring embeddings.`
    );

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      console.log(
        `Embedding frame ${i + 1}/${frames.length}...`
      );

      const embedding = await generateEmbedding(
        frame.description
      );

      frame.embedding = embedding;

      await frame.save();

      console.log(
        `Frame ${i + 1}/${frames.length} completed.`
      );
    }

    console.log("Embedding backfill completed.");
  } catch (error) {
    console.error(
      "Embedding backfill failed:",
      error.message
    );
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
};

backfillEmbeddings();