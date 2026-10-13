const Frame = require("../models/Frame");

const searchByMeaning = require("../services/search/vectorSearch.service");
const AppError = require("../utils/AppError");
const searchFrames = async (req, res) => {

    const query = req.query.q?.trim();

    if (!query) {
    throw new AppError(
      "Search query is required",
      400
    );
  }
    const results = await searchByMeaning(query);

    return res.status(200).json({
      success: true,
      count: results.length,
      results,
    });
  }
module.exports = {
  searchFrames,
};