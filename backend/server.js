
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Movie = require("./models/Movie");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const GENRES = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Romance",
  "Thriller",
];

const PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Hotstar",
  "Theatre",
  "Other",
];

const STATUSES = ["To Watch", "Watching", "Watched"];

// Separate sequence counter for each release year.
const counterSchema = new mongoose.Schema({
  _id: { type: Number, required: true },
  sequence: { type: Number, default: 0 },
});

const Counter = mongoose.model("MovieCounter", counterSchema);

// Standard JSON error response.
function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
    data: null,
  });
}

// Validate optional poster URL.
function validatePosterUrl(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return "Poster URL must be text.";
  }

  const url = value.trim();

  if (url.length > 2048) {
    return "Poster URL is too long.";
  }

  try {
    const parsed = new URL(url);

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname.includes(".")
    ) {
      return "Poster URL must be a valid HTTP or HTTPS URL.";
    }
  } catch {
    return "Please enter a valid poster image URL.";
  }

  return null;
}

// Validate fields required when adding a movie.
function validMovieFields(body) {
  const title =
    typeof body.title === "string" ? body.title.trim() : "";

  const year = Number(body.releaseYear);
  const runtime = Number(body.runtime);
  const priority = Number(body.priority);

  if (!title) return "Title is required.";
  if (title.length > 150) return "Title cannot exceed 150 characters.";

  if (!GENRES.includes(body.genre)) {
    return "Choose a valid genre.";
  }

  if (
    !Number.isInteger(year) ||
    year < 1950 ||
    year > new Date().getFullYear()
  ) {
    return "Release year is invalid.";
  }

  if (
    !Number.isInteger(runtime) ||
    runtime < 30 ||
    runtime > 300
  ) {
    return "Runtime must be between 30 and 300 minutes.";
  }

  if (!PLATFORMS.includes(body.platform)) {
    return "Choose a valid platform.";
  }

  if (
    !Number.isInteger(priority) ||
    priority < 1 ||
    priority > 5
  ) {
    return "Priority must be between 1 and 5.";
  }

  const posterError = validatePosterUrl(body.posterUrl);
  if (posterError) return posterError;

  return null;
}

function movieCode(year, sequence) {
  return `MV-${year}-${String(sequence).padStart(3, "0")}`;
}

// API health check.
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Movie Watchlist Manager API is running.",
    data: null,
  });
});

// Dashboard statistics.
app.get("/api/movies/stats", async (req, res, next) => {
  try {
    const statusCounts = await Movie.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {
      "To Watch": 0,
      Watching: 0,
      Watched: 0,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
    });

    const watchedStats = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: "$runtime" },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    const genreStats = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: "$genre",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 },
    ]);

    const watched = watchedStats[0] || {
      totalMinutes: 0,
      averageRating: null,
    };

    res.json({
      success: true,
      message: "Statistics retrieved.",
      data: {
        counts,
        totalHoursWatched:
          Math.round((watched.totalMinutes / 60) * 10) / 10,
        averageRating:
          watched.averageRating == null
            ? null
            : Math.round(watched.averageRating * 10) / 10,
        topWatchedGenre: genreStats[0]?._id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Recommend the highest-priority To Watch movie.
// If priority ties, recommend the shortest runtime.
app.get("/api/movies/watch-next", async (req, res, next) => {
  try {
    const movie = await Movie.findOne({ status: "To Watch" }).sort({
      priority: -1,
      runtime: 1,
      createdAt: 1,
    });

    if (!movie) {
      return sendError(res, 404, "No movies left to watch.");
    }

    res.json({
      success: true,
      message: "Your next movie recommendation.",
      data: movie,
    });
  } catch (error) {
    next(error);
  }
});

// List, search, filter, sort and paginate movies (6 per page).
app.get("/api/movies", async (req, res, next) => {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const page = Math.max(
      1,
      Number.isInteger(parsedPage) ? parsedPage : 1
    );
    const limit = 6;
    const filter = {};

    if (req.query.status && req.query.status !== "All") {
      if (!STATUSES.includes(req.query.status)) {
        return sendError(res, 400, "Invalid status filter.");
      }

      filter.status = req.query.status;
    }

    if (req.query.genre && req.query.genre !== "All") {
      if (!GENRES.includes(req.query.genre)) {
        return sendError(res, 400, "Invalid genre filter.");
      }

      filter.genre = req.query.genre;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.title = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    const allMatches = await Movie.find(filter).lean();

    // Show To Watch first, sorted by priority from highest to lowest.
    const statusOrder = {
      "To Watch": 0,
      Watching: 1,
      Watched: 2,
    };

    allMatches.sort((a, b) => {
      const statusDifference =
        statusOrder[a.status] - statusOrder[b.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      if (
        a.status === "To Watch" &&
        b.priority !== a.priority
      ) {
        return b.priority - a.priority;
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = allMatches.length;
    const totalPages = Math.ceil(total / limit);

    const movies = allMatches.slice(
      (page - 1) * limit,
      page * limit
    );

    res.json({
      success: true,
      message: "Movies retrieved.",
      data: {
        movies,
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Add a movie.
app.post("/api/movies", async (req, res, next) => {
  try {
    const validationError = validMovieFields(req.body);

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const title = req.body.title.trim();
    const year = Number(req.body.releaseYear);
    const titleKey = title.toLowerCase();

    const duplicate = await Movie.findOne({
      titleKey,
      releaseYear: year,
    });

    if (duplicate) {
      return sendError(
        res,
        409,
        "A movie with this title and year already exists."
      );
    }

    const counter = await Counter.findOneAndUpdate(
      { _id: year },
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const movie = await Movie.create({
      movieCode: movieCode(year, counter.sequence),
      title,
      titleKey,
      genre: req.body.genre,
      releaseYear: year,
      runtime: Number(req.body.runtime),
      platform: req.body.platform,
      priority: Number(req.body.priority),
      posterUrl: req.body.posterUrl
        ? req.body.posterUrl.trim()
        : "",
      status: "To Watch",
      rating: null,
      watchedDate: null,
    });

    res.status(201).json({
      success: true,
      message: "Movie added successfully.",
      data: movie,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "Duplicate movie or movie code."
      );
    }

    next(error);
  }
});

// Edit allowed fields. Movie code and release year remain immutable.
app.put("/api/movies/:code", async (req, res, next) => {
  try {
    const allowed = [
      "title",
      "genre",
      "runtime",
      "platform",
      "priority",
      "posterUrl",
    ];

    const keys = Object.keys(req.body);

    if (keys.some((key) => !allowed.includes(key))) {
      return sendError(
        res,
        400,
        "Only title, genre, runtime, platform, priority and poster URL can be edited."
      );
    }

    const movie = await Movie.findOne({
      movieCode: req.params.code,
    });

    if (!movie) {
      return sendError(res, 404, "Movie not found.");
    }

    if (req.body.title !== undefined) {
      const title = req.body.title;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150
      ) {
        return sendError(
          res,
          400,
          "Title must contain 1 to 150 characters."
        );
      }

      const normalizedTitle = title.trim().toLowerCase();

      const duplicate = await Movie.findOne({
        titleKey: normalizedTitle,
        releaseYear: movie.releaseYear,
        _id: { $ne: movie._id },
      });

      if (duplicate) {
        return sendError(
          res,
          409,
          "A movie with this title and year already exists."
        );
      }

      movie.title = title.trim();
      movie.titleKey = normalizedTitle;
    }

    if (req.body.genre !== undefined) {
      if (!GENRES.includes(req.body.genre)) {
        return sendError(res, 400, "Invalid genre.");
      }

      movie.genre = req.body.genre;
    }

    if (req.body.runtime !== undefined) {
      const runtime = Number(req.body.runtime);

      if (
        !Number.isInteger(runtime) ||
        runtime < 30 ||
        runtime > 300
      ) {
        return sendError(
          res,
          400,
          "Runtime must be between 30 and 300 minutes."
        );
      }

      movie.runtime = runtime;
    }

    if (req.body.platform !== undefined) {
      if (!PLATFORMS.includes(req.body.platform)) {
        return sendError(res, 400, "Invalid platform.");
      }

      movie.platform = req.body.platform;
    }

    if (req.body.priority !== undefined) {
      const priority = Number(req.body.priority);

      if (
        !Number.isInteger(priority) ||
        priority < 1 ||
        priority > 5
      ) {
        return sendError(
          res,
          400,
          "Priority must be between 1 and 5."
        );
      }

      movie.priority = priority;
    }

    if (req.body.posterUrl !== undefined) {
      const posterError = validatePosterUrl(req.body.posterUrl);

      if (posterError) {
        return sendError(res, 400, posterError);
      }

      movie.posterUrl = req.body.posterUrl
        ? req.body.posterUrl.trim()
        : "";
    }

    await movie.save();

    res.json({
      success: true,
      message: "Movie updated.",
      data: movie,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "A movie with this title and year already exists."
      );
    }

    next(error);
  }
});

// Change status. A rating is required when marking Watched.
app.patch("/api/movies/:code/status", async (req, res, next) => {
  try {
    const { status, rating } = req.body;

    if (!STATUSES.includes(status)) {
      return sendError(res, 400, "Invalid movie status.");
    }

    const movie = await Movie.findOne({
      movieCode: req.params.code,
    });

    if (!movie) {
      return sendError(res, 404, "Movie not found.");
    }

    if (movie.status === "Watched") {
      return sendError(res, 400, "Watched is a final status.");
    }

    const allowedTransitions = {
      "To Watch": ["Watching", "Watched"],
      Watching: ["Watched", "To Watch"],
      Watched: [],
    };

    if (!allowedTransitions[movie.status].includes(status)) {
      return sendError(
        res,
        400,
        "This status transition is not allowed."
      );
    }

    if (status === "Watched") {
      if (
        rating === undefined ||
        rating === null ||
        rating === ""
      ) {
        return sendError(
          res,
          400,
          "A rating from 1 to 10 is required."
        );
      }

      const numericRating = Number(rating);

      if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 10
      ) {
        return sendError(
          res,
          400,
          "Rating must be a whole number from 1 to 10."
        );
      }

      movie.rating = numericRating;
      movie.watchedDate = new Date();
    } else if (rating !== undefined) {
      return sendError(
        res,
        400,
        "Rating is only allowed when marking a movie Watched."
      );
    }

    movie.status = status;
    await movie.save();

    res.json({
      success: true,
      message: "Movie status updated.",
      data: movie,
    });
  } catch (error) {
    next(error);
  }
});

// Edit a rating later, but only for a Watched movie.
app.patch("/api/movies/:code/rating", async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 10 ||
      req.body.rating === "" ||
      req.body.rating === null ||
      req.body.rating === undefined
    ) {
      return sendError(
        res,
        400,
        "Rating must be a whole number from 1 to 10."
      );
    }

    const movie = await Movie.findOne({
      movieCode: req.params.code,
    });

    if (!movie) {
      return sendError(res, 404, "Movie not found.");
    }

    if (movie.status !== "Watched") {
      return sendError(
        res,
        400,
        "Only Watched movies can have their rating edited."
      );
    }

    movie.rating = rating;
    await movie.save();

    res.json({
      success: true,
      message: "Rating updated.",
      data: movie,
    });
  } catch (error) {
    next(error);
  }
});

// A movie currently being watched cannot be deleted.
app.delete("/api/movies/:code", async (req, res, next) => {
  try {
    const movie = await Movie.findOne({
      movieCode: req.params.code,
    });

    if (!movie) {
      return sendError(res, 404, "Movie not found.");
    }

    if (movie.status === "Watching") {
      return sendError(
        res,
        400,
        "A movie currently Watching cannot be deleted."
      );
    }

    await movie.deleteOne();

    res.json({
      success: true,
      message: "Movie deleted.",
      data: movie,
    });
  } catch (error) {
    next(error);
  }
});

// Consistent JSON error handling.
app.use((error, req, res, next) => {
  console.error(error.message);

  if (error.name === "ValidationError") {
    return sendError(res, 400, error.message);
  }

  if (error.name === "CastError" || error instanceof SyntaxError) {
    return sendError(res, 400, "Invalid request data.");
  }

  if (res.headersSent) {
    return next(error);
  }

  return sendError(res, 500, "Internal server error.");
});

// Start the server after connecting to MongoDB.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
