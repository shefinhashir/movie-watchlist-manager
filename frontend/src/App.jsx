
import { useCallback, useEffect, useState } from "react";
import {
  Film,
  Plus,
  Search,
  Clapperboard,
  Clock3,
  Star,
  Trash2,
  Pencil,
  Play,
  CheckCircle2,
  Sparkles,
  X,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import "./App.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API = `${API_BASE_URL}/api/movies`;

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

const EMPTY_FORM = {
  title: "",
  genre: "Drama",
  releaseYear: String(new Date().getFullYear()),
  runtime: "120",
  platform: "Netflix",
  priority: "3",
  posterUrl: "",
};

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Something went wrong.");
  }

  return result.data;
}

function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [rating, setRating] = useState("8");
  const [saving, setSaving] = useState(false);
  const [watchNext, setWatchNext] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        search,
        genre,
        status,
      });

      const [list, dashboard] = await Promise.all([
        apiRequest(`${API}?${params}`),
        apiRequest(`${API}/stats`),
      ]);

      setMovies(list.movies);
      setTotalPages(Math.max(1, list.totalPages));
      setStats(dashboard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, genre, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadWatchNext = async () => {
    try {
      const movie = await apiRequest(`${API}/watch-next`);
      setWatchNext(movie);
    } catch (err) {
      setNotice(err.message);
      setWatchNext(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModal("form");
  };

  const openEdit = (movie) => {
    setEditing(movie);
    setForm({
      title: movie.title,
      genre: movie.genre,
      releaseYear: String(movie.releaseYear),
      runtime: String(movie.runtime),
      platform: movie.platform,
      priority: String(movie.priority),
      posterUrl: movie.posterUrl || "",
    });
    setModal("form");
  };

  const saveMovie = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    const payload = {
      ...form,
      releaseYear: Number(form.releaseYear),
      runtime: Number(form.runtime),
      priority: Number(form.priority),
    };

    try {
      if (editing) {
        // Release year is immutable and must not be sent in the edit request.
        delete payload.releaseYear;

        await apiRequest(`${API}/${encodeURIComponent(editing.movieCode)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Movie updated successfully.");
      } else {
        await apiRequest(API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Movie added successfully.");
        setPage(1);
      }

      setModal("");
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (movie, nextStatus, nextRating) => {
    try {
      await apiRequest(
        `${API}/${encodeURIComponent(movie.movieCode)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
            ...(nextRating !== undefined ? { rating: nextRating } : {}),
          }),
        }
      );

      setModal("");
      setSelectedMovie(null);
      setNotice("Movie status updated.");
      await refresh();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const startStatusChange = (movie, nextStatus) => {
    if (nextStatus === movie.status) return;

    if (nextStatus === "Watched") {
      setSelectedMovie(movie);
      setRating("8");
      setModal("rating");
      return;
    }

    changeStatus(movie, nextStatus);
  };

  const editRating = async (event) => {
    event.preventDefault();
    if (!selectedMovie) return;

    setSaving(true);
    try {
      await apiRequest(
        `${API}/${encodeURIComponent(selectedMovie.movieCode)}/rating`,
        {
          method: "PATCH",
          body: JSON.stringify({ rating: Number(rating) }),
        }
      );
      setModal("");
      setSelectedMovie(null);
      setNotice("Rating updated.");
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (movie) => {
    if (movie.status === "Watching") {
      setNotice("Movies currently being watched cannot be deleted.");
      return;
    }

    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiRequest(`${API}/${encodeURIComponent(movie.movieCode)}`, {
        method: "DELETE",
      });
      setNotice("Movie deleted.");
      await refresh();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const formatRuntime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const statusClass = (value) =>
    value.toLowerCase().replace(/\s+/g, "-");

  const statsCards = [
    {
      label: "To Watch",
      value: stats?.counts?.["To Watch"] ?? "—",
      icon: <Clapperboard size={19} />,
      tone: "gold",
    },
    {
      label: "Watching",
      value: stats?.counts?.Watching ?? "—",
      icon: <Play size={19} />,
      tone: "blue",
    },
    {
      label: "Watched",
      value: stats?.counts?.Watched ?? "—",
      icon: <CheckCircle2 size={19} />,
      tone: "green",
    },
    {
      label: "Hours Watched",
      value: stats?.totalHoursWatched ?? "—",
      icon: <Clock3 size={19} />,
      tone: "purple",
    },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Frame home">
          <span className="brand-mark"><Film size={22} /></span>
          <span>frame<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="live-indicator" />
          <span className="topbar-label">YOUR PERSONAL CINEMA</span>
          <button className="icon-button" onClick={refresh} title="Refresh">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> YOUR CINEMA, CURATED</div>
          <h1>Every great story<br />starts <em>here.</em></h1>
          <p>Your personal space for the films you love, the stories you chase, and the ones still waiting for you.</p>
          <button className="primary-button" onClick={openAdd}>
            <Plus size={18} /> Add a movie
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-disc"><Film size={72} strokeWidth={0.8} /></div>
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✦</span>
          <span className="art-label">THE NEXT<br />CHAPTER AWAITS</span>
        </div>
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="plain-icon" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <strong>Connection issue</strong>
          <span>{error}</span>
          <button className="secondary-button" onClick={refresh}>Retry</button>
        </div>
      )}

      <section className="stats-grid" aria-label="Watchlist statistics">
        {statsCards.map((item) => (
          <article className="stat-card" key={item.label}>
            <div className={`stat-icon ${item.tone}`}>{item.icon}</div>
            <div>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="collection-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE COLLECTION</div>
            <h2>Your watchlist<span className="brand-dot">.</span></h2>
            <p className="section-subtitle">A little order for your next great movie night.</p>
          </div>
          <button className="secondary-button" onClick={loadWatchNext}>
            <Sparkles size={16} /> Watch next
          </button>
        </div>

        {watchNext && (
          <div className="recommendation">
            <div className="recommendation-icon"><Sparkles size={22} /></div>
            <div className="recommendation-copy">
              <span>YOUR NEXT FEATURE</span>
              <h3>{watchNext.title}</h3>
              <p>{watchNext.genre} · {formatRuntime(watchNext.runtime)} · Priority {watchNext.priority}/5</p>
            </div>
            <button className="plain-icon" onClick={() => setWatchNext(null)} aria-label="Close recommendation">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search your movies..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button className="plain-icon" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </label>
          <select value={genre} onChange={(event) => { setGenre(event.target.value); setPage(1); }}>
            <option value="All">All genres</option>
            {GENRES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="All">All statuses</option>
            <option>To Watch</option>
            <option>Watching</option>
            <option>Watched</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state"><LoaderCircle className="spin" size={28} /><p>Curating your collection...</p></div>
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Film size={32} /></div>
            <h3>Your next favorite is waiting.</h3>
            <p>No movies match your collection yet. Add your first film to get started.</p>
            <button className="primary-button" onClick={openAdd}><Plus size={17} /> Add your first movie</button>
          </div>
        ) : (
          <div className="movie-grid">
            {movies.map((movie, index) => (
              <article className="movie-card" key={movie.movieCode}>
                <div className={`movie-poster poster-${index % 6}`}>
                  {movie.posterUrl && (
                    <img
                      className="movie-poster-image"
                      src={movie.posterUrl}
                      alt={`${movie.title} poster`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <span className="poster-code">{movie.movieCode}</span>
                  <span className="poster-decor">{["✳", "◈", "✦", "◉", "✺", "✧"][index % 6]}</span>
                  <span className="poster-title">{movie.title}</span>
                  <span className="poster-year">{movie.releaseYear}</span>
                  <span className={`priority-tag priority-${movie.priority}`}>P{movie.priority}</span>
                </div>
                <div className="movie-info">
                  <div className="movie-title-row">
                    <h3>{movie.title}</h3>
                    <button className="plain-icon" onClick={() => openEdit(movie)} title="Edit movie" aria-label={`Edit ${movie.title}`}>
                      <Pencil size={15} />
                    </button>
                  </div>
                  <p className="movie-meta">{movie.genre} <span>·</span> {formatRuntime(movie.runtime)}</p>
                  <div className="movie-details">
                    <span className="platform-label">{movie.platform}</span>
                    {movie.rating != null && <span className="rating-label"><Star size={13} fill="currentColor" /> {movie.rating}/10</span>}
                  </div>
                  <div className="card-footer">
                    <select
                      className={`status-select status-${statusClass(movie.status)}`}
                      value={movie.status}
                      onChange={(event) => startStatusChange(movie, event.target.value)}
                      aria-label={`Status for ${movie.title}`}
                    >
                      <option>To Watch</option>
                      {movie.status !== "To Watch" && <option>Watching</option>}
                      {movie.status === "To Watch" && <option>Watching</option>}
                      {movie.status !== "Watched" && <option>Watched</option>}
                    </select>
                    {movie.status === "Watched" && (
                      <button
                        className="plain-icon rating-edit"
                        onClick={() => { setSelectedMovie(movie); setRating(String(movie.rating || 8)); setModal("edit-rating"); }}
                        title="Edit rating"
                      >
                        <Star size={15} />
                      </button>
                    )}
                    <button
                      className="plain-icon delete-button"
                      disabled={movie.status === "Watching"}
                      onClick={() => confirmDelete(movie)}
                      title={movie.status === "Watching" ? "Cannot delete while Watching" : "Delete movie"}
                      aria-label={`Delete ${movie.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && movies.length > 0 && (
          <div className="pagination">
            <span>Page {page} of {totalPages}</span>
            <div>
              <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#"><span className="brand-mark"><Film size={18} /></span><span>frame<span className="brand-dot">.</span></span></a>
        <span>MADE FOR YOUR NEXT MOVIE NIGHT</span>
      </footer>

      {modal === "form" && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}>
          <form className="modal-card" onSubmit={saveMovie}>
            <div className="modal-heading">
              <div><div className="eyebrow">{editing ? "REFINE YOUR COLLECTION" : "ADD TO YOUR COLLECTION"}</div><h2>{editing ? "Edit movie" : "New movie"}<span className="brand-dot">.</span></h2></div>
              <button type="button" className="plain-icon" onClick={() => setModal("")} aria-label="Close"><X /></button>
            </div>
            <label className="field-label">Movie title
              <input required maxLength={150} placeholder="e.g. Interstellar" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <div className="form-row">
              <label className="field-label">Genre
                <select value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>{GENRES.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="field-label">Release year
                <input required type="number" min="1950" max={new Date().getFullYear()} disabled={Boolean(editing)} value={form.releaseYear} onChange={(event) => setForm({ ...form, releaseYear: event.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label className="field-label">Runtime (minutes)
                <input required type="number" min="30" max="300" value={form.runtime} onChange={(event) => setForm({ ...form, runtime: event.target.value })} />
              </label>
              <label className="field-label">Priority
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} — {["Low", "Fair", "Medium", "High", "Top"][item - 1]}</option>)}</select>
              </label>
            </div>
            <label className="field-label">Where to watch
              <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label className="field-label">Movie poster image URL (optional)
              <input
                type="url"
                placeholder="https://example.com/movie-poster.jpg"
                value={form.posterUrl || ""}
                onChange={(event) => setForm({ ...form, posterUrl: event.target.value })}
              />
            </label>
            {form.posterUrl && (
              <div className="poster-preview-wrap">
                <span className="field-hint">Poster preview</span>
                <img
                  className="poster-form-preview"
                  src={form.posterUrl}
                  alt="Movie poster preview"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal("")}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add movie"}</button>
            </div>
          </form>
        </div>
      )}

      {(modal === "rating" || modal === "edit-rating") && selectedMovie && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}>
          <form
            className="modal-card rating-modal"
            onSubmit={(event) => {
              if (modal === "rating") {
                event.preventDefault();
                if (Number(rating) < 1 || Number(rating) > 10) return;
                changeStatus(selectedMovie, "Watched", Number(rating));
              } else {
                editRating(event);
              }
            }}
          >
            <div className="modal-heading">
              <div><div className="eyebrow">{modal === "rating" ? "ANOTHER STORY COMPLETED" : "UPDATE YOUR SCORE"}</div><h2>{modal === "rating" ? "Rate this film." : "Edit rating."}</h2></div>
              <button type="button" className="plain-icon" onClick={() => setModal("")} aria-label="Close"><X /></button>
            </div>
            <p className="rating-movie-name">{selectedMovie.title}</p>
            <label className="field-label">Your rating (1–10)
              <input type="number" min="1" max="10" step="1" required value={rating} onChange={(event) => setRating(event.target.value)} />
            </label>
            <p className="field-hint">{modal === "rating" ? "Marking this movie as Watched will save your rating and the date." : "Only watched movies can have their rating changed."}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal("")}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save rating"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
