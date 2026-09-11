const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Simple in-memory cache to prevent spamming LRCLIB
const lyricsCache = new Map();

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; 
        if (!query) {
            return res.status(400).json({ error: "Please provide a search term" });
        }

        console.log(`\n--- New Search Request: ${query} ---`);
        const safeQuery = encodeURIComponent(query);
        const url = `https://itunes.apple.com/search?term=${safeQuery}&entity=song&limit=15`;
        
        const itunesResponse = await axios.get(url);
        
        if (itunesResponse.data && itunesResponse.data.results) {
            const formattedData = itunesResponse.data.results.map(song => ({
                title: song.trackName,
                artist: { name: song.artistName },
                album: { cover_medium: song.artworkUrl100.replace('100x100', '300x300') }, 
                preview: song.previewUrl
            }));
            res.json(formattedData); 
        } else {
            res.json([]); 
        }

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "Failed to fetch music data" });
    }
});

// PHASE 5: Server-side Lyric Fetching & Caching
app.get('/api/lyrics', async (req, res) => {
    const { artist, title } = req.query;

    if (!artist || !title) {
        return res.status(400).json({ found: false, lyrics: null, error: "Missing artist or title" });
    }

    const cacheKey = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
    
    if (lyricsCache.has(cacheKey)) {
        console.log(`--- Fetching Lyrics (CACHE HIT): ${title} by ${artist} ---`);
        return res.json(lyricsCache.get(cacheKey));
    }

    console.log(`--- Fetching Lyrics (API MISS): ${title} by ${artist} ---`);

    try {
        // Clean up metadata to drastically improve LRCLIB match rates
        const cleanTitle = title.split('-')[0].split('(')[0].split('[')[0].trim();
        const cleanArtist = artist.split(',')[0].split('&')[0].split(/feat\.?/i)[0].split(/ft\.?/i)[0].trim();

        const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
        
        // 5-second timeout to prevent hung requests
        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;

        if (data && data.length > 0 && data[0].plainLyrics) {
            const result = { found: true, lyrics: data[0].plainLyrics };
            lyricsCache.set(cacheKey, result); // Save to cache
            return res.json(result);
        } else {
            const result = { found: false, lyrics: null };
            lyricsCache.set(cacheKey, result); // Cache negative results to prevent duplicate bad queries
            return res.json(result);
        }
    } catch (error) {
        console.error("Lyrics error:", error.message);
        // Return 502 Bad Gateway and do NOT cache the error, allowing future retries
        return res.status(502).json({ found: false, lyrics: null, error: "Failed to connect to lyrics provider" });
    }
});

app.listen(PORT, () => {
    console.log(`Sangeet-X Backend is alive and listening on http://localhost:${PORT}`);
});