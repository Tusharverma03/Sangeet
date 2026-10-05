# 🎵 Sangeet

**A modern,  web music player** with a built-in library, an iTunes-powered discovery feed, synced lyrics lookup, personalised recommendations, favorites, listening analytics, and the ability to upload your own tracks that persist across sessions.

Built with vanilla HTML/CSS/JavaScript on the frontend and a small Node.js + Express backend that proxies music search and lyrics.

<!-- Add a screenshot or GIF here, e.g.:
![SANGEET Discover](downloads/Home.png)
-->

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Optional Extension Module](#optional-extension-module)
- [Backend API](#backend-api)
- [How It Works](#how-it-works)
- [Data Storage](#data-storage)
- [Known Issues & Roadmap](#known-issues--roadmap)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Features

### Playback
- Play / pause, next / previous, and a seekable progress bar with live elapsed and total time
- **Shuffle** and **repeat** modes
- Context-aware playback: Next/Previous follow the list you started from (a Home category, the Library, Favorites, your uploads, or search results)
- Scrolling marquee for long song titles
- Browser **Media Session** support, so hardware media keys and OS media widgets can control playback

### Discover & Search
- **Home feed** with six curated categories (Bollywood & Hindi, 90s & Throwback, Pop Hits, International Classics, Hollywood / Soundtracks, Indian Contemporary), each deduplicated and limited to 2 songs per artist for variety
- **Search** any song or artist via the iTunes Search API
- 30-second previews are clearly marked with a **"30s Preview"** badge

### Personalisation
- **"Made For You"** shelf that appears after a few plays, scored from your favorites, recently played songs, and per-artist / per-song play counts
- Recommendations pull in extra tracks by your top artists for fresh discovery
- **Recently Played** history (last 50 tracks)
- **Analytics** dashboard: total plays, unique songs, top 5 tracks, and top 5 artists

### Library
- **Built-in Library** of full-length local tracks (Hindi classics, rock, pop, and hip-hop)
- **Favorites** ("Liked Songs") with a playlist-style page, a play-all button, and a live equalizer animation on the current track
- **Add Songs**: upload your own audio file and poster, name it, and it's saved in the browser (IndexedDB) so it's still there next time

### Lyrics
- Lyrics tab fetches lyrics through the backend from [LRCLIB](https://lrclib.net), with server-side caching (including negative results) and metadata clean-up to improve match rates
- Player panel also has **Queue** and **Details** tabs

### Polish
- Toast notifications for actions like adding or removing favorites
- Responsive card grids and horizontal shelves
- Graceful "Exit" screen that stops playback

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript (no framework or build step) |
| Icons | [Font Awesome](https://fontawesome.com) (kit loaded from CDN) |
| Backend | Node.js 24.x, [Express](https://expressjs.com) 4 |
| HTTP client | [Axios](https://axios-http.com) |
| Middleware | [CORS](https://github.com/expressjs/cors) |
| Browser storage | `localStorage` and `IndexedDB` |
| External APIs | [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/), [LRCLIB](https://lrclib.net/docs) |

---

## Project Structure

```
Sangeet/
├── Backend/
│   ├── server.js            # Express server: /api/search, /api/lyrics, /api/home
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── index.html           # App shell (sidebar, content area, player panel)
│   ├── css/
│   │   ├── style.css        # Main styles
│   │   └── extension.css    # Styles for the optional extension module
│   ├── jscript/
│   │   ├── app.js           # Core: state, player engine, navigation, library, analytics
│   │   ├── shortcuts.js     # Keyboard shortcuts + Media Session
│   │   ├── recently.js      # Recently Played view
│   │   ├── toast.js         # Toast notification system (window.showToast)
│   │   └── extension.js     # Optional: voice commands, dark mode, control bar
│   └── assets/
│       ├── audio/           # Built-in local tracks
│       └── images/          # Posters / album art + default artwork
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) **24.x** (the version declared in `Backend/package.json`)
- npm (comes with Node.js)
- A modern browser (Chrome, Edge, Firefox, or Safari)
- An internet connection (needed for the Discover feed, search, lyrics, and Font Awesome icons)

### 1. Clone the repository

```bash
git clone https://github.com/Tusharverma03/Sangeet.git
cd Sangeet
```

### 2. Install and start the backend

```bash
cd Backend
npm install
npm start
```

You should see:

```
Sangeet-X Backend is alive and listening on http://localhost:3000
```

> The frontend calls `http://localhost:3000` directly, so keep the backend running on port **3000**.

### 3. Serve the frontend

In a **second terminal**, from the project root:

```bash
# Option A: Node
npx serve frontend

# Option B: Python
cd frontend && python3 -m http.server 8080
```

Then open the URL it prints in your browser (Python's server uses `http://localhost:8080`). Port 3000 is reserved for the backend.

You can also open `frontend/index.html` directly in your browser, but a local static server is more reliable.

---

## Usage Guide

| Sidebar item | What it does |
|--------------|--------------|
| **Home** | Discover feed with category shelves, plus "Made For You" once you've played a few songs |
| **Search** | Search the iTunes catalog (press Enter to search) |
| **Added Songs** | Songs you uploaded yourself |
| **Library** | Built-in full-length tracks |
| **Add Songs** | Upload audio + poster, set a name and artist, then Submit |
| **Favorites** | Your liked songs, with a Play Playlist button (double-click a row to play it) |
| **Analytics** | Your listening stats |
| **Recently Played** | Your last 50 plays |
| **Exit** | Stops playback and shows a goodbye screen |

**Tips**
- Click a song card to play it. **Right-click** a card to add it to the queue.
- Click the heart in the player panel to favorite the current song.
- Use the **Lyrics / Queue / Details** tabs in the player panel.

---

## Keyboard Shortcuts

Shortcuts are ignored while you're typing in an input field.

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `→` | Next track |
| `←` | Previous track |
| `L` | Like / unlike the current song |
| `S` | Toggle shuffle* |
| `R` | Toggle repeat* |
| `D` | Toggle dark mode* |

\* These three shortcuts trigger buttons that come from the [extension module](#optional-extension-module).

---

## Optional Extension Module

`frontend/jscript/extension.js` and `frontend/css/extension.css` add a floating control bar (Liked, Shuffle, Repeat, Dark/Light, Voice) and **voice commands** using the browser's Web Speech API (`en-IN` locale), without modifying the core player.

They are **not included in `index.html` by default**. To enable them, add these two lines:

```html
<!-- in <head> -->
<link rel="stylesheet" href="css/extension.css">

<!-- before </body>, after app.js -->
<script src="jscript/extension.js"></script>
```

**Supported voice commands**

| Say | Result |
|-----|--------|
| "play" / "resume" | Resume playback |
| "play *song or artist*" | Plays the best title/artist match from the songs currently loaded |
| "pause" / "stop" | Pause |
| "next song" / "skip" | Next track |
| "previous" / "go back" | Previous track |
| "volume up" / "volume down" | Adjust volume by 10% |
| "shuffle on" / "shuffle off" | Toggle shuffle |
| "dark mode" / "light mode" | Switch theme |
| "like" / "favorite" | Toggle favorite on the current song |

Voice recognition requires a browser that supports the Web Speech API (Chrome and Edge work best).

---

## Backend API

Base URL: `http://localhost:3000`

### `GET /api/search?q=<term>`

Searches iTunes for songs (up to 15 results).

```json
[
  {
    "title": "Song Name",
    "artist": { "name": "Artist Name" },
    "album": { "cover_medium": "https://.../300x300bb.jpg" },
    "preview": "https://.../preview.m4a"
  }
]
```

Returns `400` if `q` is missing and `500` if the upstream request fails.

### `GET /api/lyrics?artist=<name>&title=<name>`

Fetches plain-text lyrics from LRCLIB. Titles and artist names are cleaned (featured artists, brackets, and suffixes are stripped) to improve matching. Results, including misses, are cached in memory.

```json
{ "found": true, "lyrics": "Line one\nLine two\n..." }
```

Returns `400` if a parameter is missing and `502` if the lyrics provider can't be reached (errors are *not* cached, so retries work).

### `GET /api/home`

Returns the Discover catalog: six categories of up to 50 songs each, deduplicated, with a maximum of 2 songs per artist per category. Cached for **15 minutes**, and falls back to stale cache if iTunes is unreachable.

```json
{
  "success": true,
  "categories": [
    {
      "id": "bollywood",
      "title": "Bollywood & Hindi",
      "songs": [
        {
          "id": "itunes_123456",
          "title": "Song Name",
          "artist": "Artist Name",
          "album": "Album Name",
          "artwork": "https://...",
          "audioUrl": "https://...",
          "duration": 215.3,
          "source": "itunes",
          "isPreview": true
        }
      ]
    }
  ]
}
```

---

## How It Works

**Single source of truth.** `app.js` keeps one `appState` object (current song, playback status, settings, favorites, recents, analytics, and a `songRegistry` that maps every song ID to its data). Every song, whether built-in, from iTunes, or uploaded, is normalised into the same shape (`id`, `title`, `artist`, `album`, `artwork`, `audioUrl`, `duration`, `source`, `isPreview`).

**Central Player API.** A global `Player` object wraps a single `<audio>` element and exposes `loadSong`, `play`, `pause`, `togglePlay`, `seek`, `next`, and `previous`. Keyboard shortcuts, Media Session handlers, and the extension's voice commands all go through this API instead of touching the audio element directly.

**Modular scripts.** `shortcuts.js`, `recently.js`, `toast.js`, and `extension.js` are self-contained IIFEs that hook into the core via globals (`Player`, `appState`, `showToast`, `toggleFavorite`).

**Recommendations.** After 3+ plays, each candidate song is scored: `+50` if favorited, `+20` if its artist is favorited, `+8` per artist play, `+12` per song play, `+25` if recently played, plus a small random jitter. Songs by your top artists are allowed up to 4 slots; every other artist gets 1, for variety.

---

## Data Storage

Everything user-specific stays in your browser. Nothing is sent to a server.

| Data | Where | Key / Store |
|------|-------|-------------|
| Favorites | `localStorage` | `sangeet_favs_v4` |
| Recently played | `localStorage` | `sangeet_recent_v5` |
| Analytics | `localStorage` | `sangeet_analytics_v5` |
| Uploaded songs (audio + poster files) | `IndexedDB` | database `SangeetDB`, store `songs` |
| Dark mode (extension) | `localStorage` | `mp_dark` |

Clearing site data in your browser resets all of the above.

---

## Known Issues & Roadmap

**Known issues**
- Five entries in the built-in library list point to files that aren't in `assets/` (*Aaj Phir Jeene Ki Tamanna Hai*, *Bohemian Rhapsody*, *Mera Mann Tera Pyaasa*, *Can't Help Falling in Love*, *Allah Duhai Hai*). Add the files or remove those entries from `rawLocalSongs` in `jscript/app.js`.
- The backend URL (`http://localhost:3000`) is hard-coded in `app.js`, so deploying the backend elsewhere means updating it.
- iTunes tracks are 30-second previews only; that's an API limitation.
- The "Details" tab currently shows static text.
- `lyrics-finder` is listed in `Backend/package.json` but isn't used by `server.js`.

**Ideas for the future**
- Make the API base URL configurable
- Playlists beyond Favorites, and queue management (reorder / remove)
- Synced (time-aligned) lyrics using LRCLIB's `syncedLyrics`
- Volume control and a mini-player
- Mobile layout improvements
- Wire the extension module (dark mode, voice) into the default build

---

## Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## Disclaimer

Sangeet-X is a personal / educational project. Search results and previews come from the iTunes Search API, and lyrics come from LRCLIB, both subject to their own terms. Audio files in `frontend/assets/audio/` may be copyrighted by their respective owners; if you fork or deploy this project, make sure you have the rights to any music you distribute.

---

## License

No license has been specified yet. Add a `LICENSE` file (for example [MIT](https://choosealicense.com/licenses/mit/)) and update this section.

---

## Author

Made by [@Tusharverma03](https://github.com/Tusharverma03).
