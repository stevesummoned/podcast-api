// ============================================================
//  PODCAST API — Node.js + Express + MySQL
//  A beginner-friendly REST API for your podcast database
// ============================================================
//
//  SETUP INSTRUCTIONS
//  ------------------
//  1. Make sure Node.js is installed (https://nodejs.org)
//  2. In your project folder, run:
//       npm init -y
//       npm install express mysql2 dotenv
//  3. Create a .env file in the same folder (see below)
//  4. Run the server:
//       node server.js
//  5. Test it at: http://localhost:3000/api/episodes
//
//  .env FILE CONTENTS (fill in your hosting DB credentials)
//  ---------------------------------------------------------
//  DB_HOST=your_mysql_host
//  DB_USER=your_mysql_username
//  DB_PASSWORD=your_mysql_password
//  DB_NAME=podcast_db
//  PORT=3000
// ============================================================

const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(express.json()); // Lets the API read JSON request bodies

// ------------------------------------------------------------
//  DATABASE CONNECTION POOL
//  A pool reuses connections instead of opening a new one
//  every request — better for performance.
// ------------------------------------------------------------
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ------------------------------------------------------------
//  ROOT ROUTE — quick health check
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ message: "🎙️ Podcast API is running!" });
});

// ============================================================
//  SEASONS
// ============================================================

// GET /api/seasons — list all seasons
app.get("/api/seasons", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM seasons ORDER BY season_number");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/seasons/:id — get one season by ID
app.get("/api/seasons/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM seasons WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Season not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seasons — create a new season
app.post("/api/seasons", async (req, res) => {
  const { season_number, title, description, start_date, end_date } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO seasons (season_number, title, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
      [season_number, title, description, start_date, end_date]
    );
    res.status(201).json({ id: result.insertId, message: "Season created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  EPISODES
// ============================================================

// GET /api/episodes — list all episodes (with their season info)
app.get("/api/episodes", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        e.*,
        s.season_number,
        s.title AS season_title
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      ORDER BY s.season_number, e.episode_number
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/episodes/:id — get one episode with its guests and reviews
app.get("/api/episodes/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Fetch the episode itself
    const [episodes] = await db.query(`
      SELECT e.*, s.season_number, s.title AS season_title
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE e.id = ?
    `, [id]);

    if (episodes.length === 0) return res.status(404).json({ error: "Episode not found" });

    // Fetch guests for this episode
    const [guests] = await db.query(`
      SELECT g.*
      FROM guests g
      JOIN episode_guests eg ON g.id = eg.guest_id
      WHERE eg.episode_id = ?
    `, [id]);

    // Fetch reviews for this episode
    const [reviews] = await db.query(
      "SELECT * FROM reviews WHERE episode_id = ?", [id]
    );

    // Combine everything into one response object
    res.json({ ...episodes[0], guests, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/episodes — add a new episode
app.post("/api/episodes", async (req, res) => {
  const { season_id, episode_number, title, description, release_date, duration_minutes, audio_url } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO episodes
        (season_id, episode_number, title, description, release_date, duration_minutes, audio_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [season_id, episode_number, title, description, release_date, duration_minutes, audio_url]
    );
    res.status(201).json({ id: result.insertId, message: "Episode created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  GUESTS
// ============================================================

// GET /api/guests — list all guests
app.get("/api/guests", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM guests ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/guests — add a new guest
app.post("/api/guests", async (req, res) => {
  const { name, bio, website, social_handle } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO guests (name, bio, website, social_handle) VALUES (?, ?, ?, ?)",
      [name, bio, website, social_handle]
    );
    res.status(201).json({ id: result.insertId, message: "Guest created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/episodes/:id/guests — link an existing guest to an episode
app.post("/api/episodes/:id/guests", async (req, res) => {
  const { guest_id } = req.body;
  try {
    await db.query(
      "INSERT INTO episode_guests (episode_id, guest_id) VALUES (?, ?)",
      [req.params.id, guest_id]
    );
    res.status(201).json({ message: "Guest linked to episode" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  REVIEWS
// ============================================================

// GET /api/reviews — list all movie reviews, sorted by rating
app.get("/api/reviews", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.*,
        e.title AS episode_title,
        e.episode_number,
        s.season_number
      FROM reviews r
      JOIN episodes e ON r.episode_id = e.id
      JOIN seasons s ON e.season_id = s.id
      ORDER BY r.rating DESC, r.movie_title
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — add a movie review to an episode
app.post("/api/reviews", async (req, res) => {
  const { episode_id, movie_title, movie_release_year, genre, director, rating, review_notes } = req.body;

  // Validate rating is 1–5
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO reviews
        (episode_id, movie_title, movie_release_year, genre, director, rating, review_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [episode_id, movie_title, movie_release_year, genre, director, rating, review_notes]
    );
    res.status(201).json({ id: result.insertId, message: "Review added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  START THE SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎙️ Podcast API running on http://localhost:${PORT}`);
});
