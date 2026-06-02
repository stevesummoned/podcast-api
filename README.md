# Podcast API

A REST API built with Node.js, Express, and MySQL for managing podcast episodes, movie reviews, and guests.

## Tech Stack
- Node.js
- Express
- MySQL
- XAMPP (local development)

## API Routes
- GET /api/episodes — all episodes
- GET /api/episodes/:id — single episode with guests and reviews
- GET /api/seasons — all seasons
- GET /api/reviews — all reviews sorted by rating
- GET /api/guests — all guests
- POST routes available for all of the above