# 🎬 Movie Watchlist Manager

A full-stack MERN application to organize your movie watchlist, track viewing progress, prioritize what to watch next, and rate movies you've completed.

## ✨ Features

- **Manage movies** — Add and edit movie details.
- **Track watch status** — To Watch, Watching, and Watched.
- **Set priorities** — Prioritize movies on a scale of 1–5.
- **Rate watched movies** — Give completed movies a rating from 1–10.
- **Automatic movie codes** — Each movie receives a unique code such as `MV-2026-001`.
- **Movie posters** — Display posters using image URLs.
- **Search and filters** — Find movies and filter your collection.
- **Pagination** — Browse movies six at a time.
- **Watch Next** — Get recommendations from your prioritized watchlist.
- **Statistics dashboard** — View an overview of your movie collection.
- **Duplicate prevention** — Prevent duplicate movie titles for the same release year.
- **Responsive dark UI** — A dark violet-themed interface.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas
- **ODM:** Mongoose
- **Deployment:** Vercel (frontend), Render (backend)

## 📁 Project Structure

```text
movie-watchlist-manager/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── .gitignore
└── README.md
```

*The exact files and folders may vary depending on the project setup.*

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/shefinhashir/movie-watchlist-manager.git
cd movie-watchlist-manager
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Replace the placeholder with your MongoDB connection string. **Never commit your `.env` file or publish database credentials.**

Start the backend:

```bash
npm start
```

### 3. Set up the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend` with:

```env
VITE_API_URL=http://localhost:5000
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed in your terminal by Vite.

## 🌐 Deployment

- **Frontend:** Deploy the `frontend` directory using Vercel.
- **Backend:** Deploy the `backend` directory using Render.
- **Database:** Configure MongoDB Atlas and set `MONGO_URI` in the Render environment variables.
- **Frontend API URL:** Set `VITE_API_URL` to your deployed backend's base URL in Vercel.

Do not include `/api/movies` in `VITE_API_URL`; the frontend appends its API path automatically.

## 🎯 Project Goal

This project demonstrates full-stack web development using React, Express, Node.js, and MongoDB, including REST API integration, database operations, validation, and deployment.

## 👨‍💻 Author

**Shefin Hashir**

GitHub: [@shefinhashir](https://github.com/shefinhashir)
