
const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    movieCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    genre: {
      type: String,
      required: true,
      enum: [
        "Action",
        "Comedy",
        "Drama",
        "Horror",
        "Sci-Fi",
        "Romance",
        "Thriller",
      ],
    },
    releaseYear: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear(),
      immutable: true,
    },
    runtime: {
      type: Number,
      required: true,
      min: 30,
      max: 300,
    },
    posterUrl: {
      type: String,
      trim: true,
      default: "",
    },
    platform: {
      type: String,
      required: true,
      enum: ["Netflix", "Prime Video", "Hotstar", "Theatre", "Other"],
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    status: {
      type: String,
      enum: ["To Watch", "Watching", "Watched"],
      default: "To Watch",
    },
    rating: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },
    watchedDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate titles in the same release year.
movieSchema.index({ titleKey: 1, releaseYear: 1 }, { unique: true });

module.exports = mongoose.model("Movie", movieSchema);
