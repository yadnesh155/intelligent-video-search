const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const Video = require("./models/Video");
const videoRoutes = require("./routes/videoRoutes");
const searchRoutes = require("./routes/searchRoutes");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

//connect to mongodb
connectDB();

//Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/api/videos", videoRoutes);
app.use("/api/search", searchRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Video Search API is running",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
