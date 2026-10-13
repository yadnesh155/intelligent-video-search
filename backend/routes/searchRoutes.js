const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  searchFrames,
} = require("../controllers/searchController");

const router = express.Router();

router.get(
  "/",
   asyncHandler(searchFrames));

module.exports = router;