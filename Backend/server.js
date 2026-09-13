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

// PHASE 7A: Cached Home Catalog
// PHASE 7B: Deep Categories & Diversity Rules
let homeCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

app.get('/api/home', async (req, res) => {
    const now = Date.now();
    if (homeCache.data && (now - homeCache.timestamp < CACHE_DURATION)) {
        console.log("--- Fetching Discover Catalog (CACHE HIT) ---");
        return res.json({ success: true, categories: homeCache.data });
    }

    console.log("--- Fetching Discover Catalog (API MISS) ---");
    try {
       const categoryDefs = [
            { id: 'bollywood', title: 'Bollywood & Hindi', term: 'bollywood' }, // Removed "hits" to reduce compilation albums
            { id: '90s', title: '90s & Throwback', term: '1990s' }, // "1990s" surfaces more original albums than "90s hits"
            { id: 'pop', title: 'Pop Hits', term: 'pop music' },
            { id: 'international', title: 'International Classics', term: 'international classics' },
            { id: 'hollywood', title: 'Hollywood / Soundtracks', term: 'movie soundtrack' },
            { id: 'indian-contemporary', title: 'Indian Contemporary', term: 'indian pop' }
        ];

        let finalCategories = [];

        for (let cat of categoryDefs) {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cat.term)}&entity=song&limit=50`;
            const response = await axios.get(url, { timeout: 6000 });
            
            if (response.data && response.data.results) {
                let uniqueTracks = new Map();
                let artistCounts = {};
                let songs = [];

                for (let song of response.data.results) {
                    if (!song.previewUrl || !song.trackId) continue;
                    
                    let safeTitle = song.trackName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    let safeArtist = (song.artistName || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    let dedupeKey = `${safeTitle}_${safeArtist}`;
                    
                    if (uniqueTracks.has(dedupeKey) || uniqueTracks.has(song.trackId)) continue;
                    
                    let aName = song.artistName || 'Unknown Artist';
                    // DIVERSITY RULE: Maximum 2 songs per artist per category
                    if ((artistCounts[aName] || 0) >= 2) continue; 
                    
                    artistCounts[aName] = (artistCounts[aName] || 0) + 1;
                    uniqueTracks.set(dedupeKey, true);
                    uniqueTracks.set(song.trackId, true);

                    songs.push({
                        id: `itunes_${song.trackId}`,
                        title: song.trackName,
                        artist: aName,
                        album: song.collectionName || null,
                        artwork: song.artworkUrl100 ? song.artworkUrl100.replace('100x100', '300x300') : 'assets/images/default.png',
                        audioUrl: song.previewUrl,
                        duration: song.trackTimeMillis ? song.trackTimeMillis / 1000 : null,
                        source: "itunes",
                        isPreview: true
                    });
                }
                if (songs.length > 0) {
                    finalCategories.push({ id: cat.id, title: cat.title, songs: songs });
                }
            }
        }

        if (finalCategories.length > 0) {
            homeCache = { data: finalCategories, timestamp: now };
            return res.json({ success: true, categories: finalCategories });
        } else {
            if (homeCache.data) return res.json({ success: true, categories: homeCache.data });
            return res.json({ success: false, categories: [], error: "Home catalog unavailable" });
        }
    } catch (error) {
        console.error("Home API Error:", error.message);
        if (homeCache.data) return res.json({ success: true, categories: homeCache.data });
        return res.json({ success: false, categories: [], error: "Home catalog unavailable" });
    }
});

app.listen(PORT, () => {
    console.log(`Sangeet-X Backend is alive and listening on http://localhost:${PORT}`);
});