const mongoose = require("mongoose");

const frameSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },

    framePath: {
      type: String,
      required: true,
    },
    
    storagePath: {
    type: String,
    default: null,
    },

    timestamp: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    keywords: {
      type: [String],
      default: [],
    },

    embedding: {
      type: [Number],
      default: [],
    },
    
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    processingError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

frameSchema.index(
  { video: 1, timestamp: 1 },
  { unique: true }
);

frameSchema.index({
  description: "text",
  keywords: "text",
});

module.exports = mongoose.model("Frame", frameSchema);