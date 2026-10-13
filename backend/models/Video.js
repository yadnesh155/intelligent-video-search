const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
    {
        originalName: {
            type: String,
            required: true,
            trim: true,
        },

        filename: {
            type:String,
            required: true,
        },

        path: {
            type: String,
            required: true,
        },

        duration: {
            type: Number,
            default: 0,
        },

        processingStatus: {
            type: String,
            enum: [
                "pending",
                "processing",
                "completed",
                "completed_with_errors",
                "failed",
                ],
            default: "pending",
            index: true,
        },

        processingError: {
            type: String,
            default: null,
        },

        totalFrames: {
            type: Number,
            default: 0,
        },

        processedFrames: {
            type: Number,
            default: 0,
        },
        
        processingStage: {
        type: String,
        enum: [
            "queued",
            "extracting",
            "analyzing",
            "completed",
            "failed",
        ],
        default: "queued",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Video",videoSchema);