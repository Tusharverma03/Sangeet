const lyricsFinder = require('lyrics-finder');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; 
        if (!query) {
            return res.status(400).json({ error: "Please provide a search term" });
        }

        console.log(`\n--- New Search Request: ${query} ---`);
        const safeQuery = encodeURIComponent(query);
        
        // Using iTunes API instead of Deezer to bypass the region lock
        const url = `https://itunes.apple.com/search?term=${safeQuery}&entity=song&limit=15`;
        console.log(`Asking iTunes: ${url}`);
        
        const itunesResponse = await axios.get(url);
        
        if (itunesResponse.data && itunesResponse.data.results) {
            // Transform iTunes data to look exactly like Deezer data
            const formattedData = itunesResponse.data.results.map(song => ({
                title: song.trackName,
                artist: { name: song.artistName },
                album: { cover_medium: song.artworkUrl100.replace('100x100', '300x300') }, 
                preview: song.previewUrl
            }));
            
            console.log(`Success! Found ${formattedData.length} songs.`);
            res.json(formattedData); 
        } else {
            console.log("iTunes returned empty data.");
            res.json([]); 
        }

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "Failed to fetch music data" });
    }
});
// NEW ROUTE: Fetch lyrics via your custom server
app.get('/api/lyrics', async (req, res) => {
    const { artist, title } = req.query;
    console.log(`--- Fetching Lyrics: ${title} by ${artist} ---`);
    
    try {
        // The package scrapes lyrics directly without needing API keys
        const lyrics = await lyricsFinder(artist, title); 
        
        if (lyrics) {
            res.json({ lyrics: lyrics });
        } else {
            res.status(404).json({ error: "Lyrics not found" });
        }
    } catch (error) {
        console.error("Lyrics error:", error);
        res.status(500).json({ error: "Server failed to fetch lyrics" });
    }
});

// THIS IS THE CRUCIAL PART THAT WAS MISSING!
app.listen(PORT, () => {
    console.log(`Sangeet-X Backend is alive and listening on http://localhost:${PORT}`);
});