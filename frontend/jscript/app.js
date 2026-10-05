/* =========================================================
   CHAPTER 1: CENTRAL STATE, REGISTRY & NORMALIZERS
   ========================================================= */
  const IndexedDBManager = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("SangeetDB", 2);
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("songs")) {
                    db.createObjectStore("songs", { keyPath: "id" });
                }
            };
            request.onsuccess = e => { this.db = e.target.result; resolve(); };
            request.onerror = e => reject(e.target.error);
        });
    },
    async saveSong(song, audioFile, posterFile) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("songs", "readwrite");
            tx.objectStore("songs").put({ ...song, audioFile, posterFile });
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e.target.error);
        });
    },
    async getAllSongs() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("songs", "readonly");
            const request = tx.objectStore("songs").getAll();
            request.onsuccess = () => {
                const songs = request.result.map(data => {
                    // Regenerate fresh URLs on every app startup
                    if (data.audioFile) data.audioUrl = URL.createObjectURL(data.audioFile);
                    if (data.posterFile) data.artwork = URL.createObjectURL(data.posterFile);
                    delete data.audioFile;
                    delete data.posterFile;
                    return data;
                });
                resolve(songs);
            };
            request.onerror = e => reject(e.target.error);
        });
    }
};
   const appState = {
    currentSong: null,
    isPlaying: false,
    playback: { currentTime: 0, duration: 0 },
    settings: { shuffle: false, repeat: false, darkMode: true },
    queue: [],
    library: {
        favorites: JSON.parse(localStorage.getItem("sangeet_favs_v4")) || [],
        recentlyPlayed: JSON.parse(localStorage.getItem("sangeet_recent_v5")) || [],
        addedSongs: [],
        analytics: JSON.parse(localStorage.getItem("sangeet_analytics_v5")) || { totalPlays: 0, uniqueSongs: 0, artistPlays: {}, songPlays: {}, artistImages: {} }
    },
    songRegistry: {},
    lastTrackedSessionId: null 
};

let homeCategories = []; 
let madeForYou = null;
let personalizedCandidatesPool = [];
let localSongs = []; 
let currentPlaylistContext = []; // Tracks the active list of songs for next/previous navigation
let currentActiveSong = appState.currentSong; 
let fetchedPersonalizedArtists = new Set();

function normalizeKey(str) {
    return (str || '').toLowerCase().trim();
}     
let isPlayingAudio = appState.isPlaying;           

const controller = document.querySelector(".slider");
const songsMenuDiv = document.querySelector('.songs-menu');
if(controller) controller.value = 0;

function registerSong(song) {
    appState.songRegistry[song.id] = song;
    return song;
}

function normalizeLocalSong(raw) {
    return {
        id: `local_${raw.name}_${raw.singer}`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        title: raw.name,
        artist: raw.singer,
        album: null,
        artwork: raw.poster,
        audioUrl: raw.audio,
        duration: null,
        source: "local",
        isPreview: false
    };
}

function normalizeITunesSong(apiSong) {
    let safeTitle = apiSong.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    let safeArtist = (apiSong.artist?.name || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return {
        id: apiSong.trackId ? `itunes_${apiSong.trackId}` : `itunes_${safeTitle}_${safeArtist}`,
        title: apiSong.title,
        artist: apiSong.artist?.name || 'Unknown Artist',
        album: apiSong.album?.title || null,
        artwork: apiSong.album?.cover_medium || 'assets/images/default.png',
        audioUrl: apiSong.preview,
        duration: apiSong.duration || null,
        source: "itunes",
        isPreview: true
    };
}

function normalizeImportedSong(name, artist, posterUrl, audioUrl) {
    return {
        id: `imported_${Date.now()}_${name}`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        title: name,
        artist: artist,
        album: null,
        artwork: posterUrl,
        audioUrl: audioUrl,
        duration: null,
        source: "imported",
        isPreview: false
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("shuffle-btn")?.addEventListener("click", function() {
        appState.settings.shuffle = this.classList.contains("active");
    });
    document.getElementById("repeat-btn")?.addEventListener("click", function() {
        appState.settings.repeat = this.classList.contains("active");
    });

    try {
        if (typeof IndexedDBManager !== 'undefined') {
            await IndexedDBManager.init();
            appState.library.addedSongs = await IndexedDBManager.getAllSongs();
        }
    } catch (e) {
        console.error("IndexedDB initialization failed.", e);
    }

    appState.library.favorites.forEach(registerSong);
    appState.library.addedSongs.forEach(registerSong);

    // FIX: Actually execute the function to load the songs!
    await loadHomeSongs(); 
});

/* =========================================================
   CHAPTER 2: SANGEET BUILT-IN LOCAL LIBRARY
========================================================= */
const rawLocalSongs = [
    { name: "Lag Ja Gale", singer: "Lata Mangeshkar", poster: "assets/images/lagJaGale.jpg", audio: "assets/audio/lagJaGale.mp3" },
    { name: "Imagine", singer: "John Lennon", poster: "assets/images/imagine.jpg", audio: "assets/audio/imagine.mp3" },
    { name: "Pal Pal Dil Ke Paas", singer: "Kishore Kumar", poster: "assets/images/pal_pal_dil_ke_paas.jpg", audio: "assets/audio/pal_pal_dil_ke_paas.mp3" },
    { name: "Stand by Me", singer: "Ben E. King", poster: "assets/images/stand_by_me.jpg", audio: "assets/audio/stand_by_me.mp3" },
    { name: "Kabhi Kabhie Mere Dil Mein", singer: "Mukesh", poster: "assets/images/kabhi_kabhie_mere_dil_mein.jpg", audio: "assets/audio/kabhi_kabhie_mere_dil_mein.mp3" },
    { name: "Hotel California", singer: "The Eagles", poster: "assets/images/hotel_california.jpg", audio: "assets/audio/hotel_california.mp3" },
    { name: "Chura Liya Hai Tumne", singer: "Asha Bhosle", poster: "assets/images/chura_liya_hai_tumne.jpg", audio: "assets/audio/chura_liya_hai_tumne.mp3" },
    { name: "Let It Be", singer: "The Beatles", poster: "assets/images/let_it_be.jpg", audio: "assets/audio/let_it_be.mp3" },
    { name: "Yeh Shaam Mastani", singer: "Kishore Kumar", poster: "assets/images/yeh_sham_mastani.jpg", audio: "assets/audio/yeh_sham_mastani.mp3" },
    { name: "Suspicious Minds", singer: "Elvis Presley", poster: "assets/images/suspicious_minds.jpg", audio: "assets/audio/suspicious_minds.mp3" },
    { name: "Tere Bina Zindagi Se", singer: "Lata Mangeshkar", poster: "assets/images/tere_bina_zindagi_se.jpg", audio: "assets/audio/tere_bina_zindagi_se.mp3" },
    { name: "Careless Whisper", singer: "George Michael", poster: "assets/images/careless_whisper.jpg", audio: "assets/audio/careless_whisper.mp3" },
    { name: "Roop Tera Mastana", singer: "Kishore Kumar", poster: "assets/images/roop_tera_mastana.jpg", audio: "assets/audio/roop_tera_mastana.mp3" },
    { name: "My Way", singer: "Frank Sinatra", poster: "assets/images/my_way.jpg", audio: "assets/audio/my_way.mp3" },
    { name: "Ek Pyar Ka Nagma Hai", singer: "Lata Mangeshkar", poster: "assets/images/ek_pyar_ka_nagma_hai.jpg", audio: "assets/audio/ek_pyar_ka_nagma_hai.mp3" },
    { name: "Summer of '69", singer: "Bryan Adams", poster: "assets/images/summer_of_69.jpg", audio: "assets/audio/summer_of_69.mp3" },
    { name: "Aaj Phir Jeene Ki Tamanna Hai", singer: "Lata Mangeshkar", poster: "assets/images/aaj_phir_jeene_ki_tamanna_hai.jpg", audio: "assets/audio/aaj_phir_jeene_ki_tamanna_hai.mp3" },
    { name: "Bohemian Rhapsody", singer: "Queen", poster: "assets/images/bohemian_rhapsody.jpg", audio: "assets/audio/bohemian_rhapsody.mp3" },
    { name: "Mera Mann Tera Pyaasa", singer: "Mohammed Rafi", poster: "assets/images/mera_mann_tera_pyaasa.jpg", audio: "assets/audio/mera_mann_tera_pyaasa.mp3" },
    { name: "Can't Help Falling in Love", singer: "Elvis Presley", poster: "assets/images/cant_help_falling_in_love.jpg", audio: "assets/audio/cant_help_falling_in_love.mp3" },
    { name: "capital", singer: "nanku", poster: "assets/images/capital.jpg", audio: "assets/audio/capital.mp3" },
    { name: "101", singer: "seedhe maut", poster: "assets/images/101.jpg", audio: "assets/audio/101.mp3" },
    { name: "11k", singer: "seedhe maut", poster: "assets/images/11k.jpg", audio: "assets/audio/11k.mp3" },
    { name: "heeriye", singer: "nanku", poster: "assets/images/heeriye.jpg", audio: "assets/audio/heeriye.mp3" },
    { name: "kamikaze", singer: "nanku", poster: "assets/images/kamikaze.jpg", audio: "assets/audio/kamikaze.mp3" },
    { name: "namastute", singer: "seedhe maut", poster: "assets/images/namastute.jpg", audio: "assets/audio/namastute.mp3" },
    { name: "aajkal", singer: "nanku", poster: "assets/images/aajkal.jpg", audio: "assets/audio/aajkal.mp3" },
    { name: "nanchaku", singer: "mc stan", poster: "assets/images/nanchaku.jpg", audio: "assets/audio/nanchaku.mp3" },
    { name: "Allah duhai hai", singer: "Amit mishra", poster: "assets/images/m.jpeg", audio: "assets/audio/Allah Duhai Hai Race 3 320 Kbps.mp3" },
    { name: "33 Max Verstappen", singer: "Carte Blanq & Maxx Power", poster: "assets/images/max.jpeg", audio: "assets/audio/Carte Blanq & Maxx Power - 33 Max Verstappen (Official Audio).mp3" },
    { name: "Kids", singer: "Kyle Dixon & Michael Stein", poster: "assets/images/wp1839578-stranger-things-wallpapers.jpg", audio: "assets/audio/Kyle_Dixon_Michael_Stein_-_Kids_Stranger_Things_OST_(mp3.pm).mp3" },
    { name: "Ehsaas", singer: "Faheem Abdullah", poster: "assets/images/VG.jpeg", audio: "assets/audio/Ehsaas (Lyric Video) Faheem Abdullah _ Vaibhav Pani _ Hyder Dar(MP3_160K).mp3" }
];

localSongs = rawLocalSongs.map(s => registerSong(normalizeLocalSong(s)));

/* =========================================================
   CHAPTER 3: THE LOGICAL AUDIO PLAYER ENGINE
========================================================= */
const Player = {
    audio: new Audio(),
    currentSessionId: null, 
    
    init() {
        this.audio.id = "main-audio-player";
        document.body.appendChild(this.audio);

        this.audio.addEventListener('timeupdate', () => updateProgressUI());
        this.audio.addEventListener('loadedmetadata', () => {
            if (controller) controller.max = this.audio.duration;
            document.getElementById("total-time").innerText = formatTime(this.audio.duration);
        });
        
       this.audio.addEventListener('playing', () => {
            if (!appState.currentSong || appState.lastTrackedSessionId === this.currentSessionId) return;
            appState.lastTrackedSessionId = this.currentSessionId;
            
            const songId = appState.currentSong.id;
            const artist = appState.currentSong.artist;
            const title = appState.currentSong.title;

            let recent = appState.library.recentlyPlayed;
            if (recent.length === 0 || recent[0] !== songId) {
                recent = recent.filter(id => id !== songId);
                recent.unshift(songId);
                if (recent.length > 50) recent.pop();
                appState.library.recentlyPlayed = recent;
                localStorage.setItem("sangeet_recent_v5", JSON.stringify(recent));
            }

            let stats = appState.library.analytics;
            stats.artistImages = stats.artistImages || {};
            
            // FIX: Canonical Normalization
            let nArtist = normalizeKey(artist);
            let nSongKey = `${artist} - ${title}`; 

            stats.totalPlays++;
            stats.artistPlays[nArtist] = (stats.artistPlays[nArtist] || 0) + 1;
            stats.songPlays[nSongKey] = (stats.songPlays[nSongKey] || 0) + 1;
            stats.uniqueSongs = Object.keys(stats.songPlays).length;
            stats.artistImages[nArtist] = appState.currentSong.artwork;
   
            localStorage.setItem("sangeet_analytics_v5", JSON.stringify(stats));

            // FIX: Trigger the dynamic recommendation lifecycle on new plays
            if (typeof triggerDynamicPersonalization === 'function') triggerDynamicPersonalization();
        });

        this.audio.addEventListener('ended', () => this.handleEnded());
    },

    loadSong(song) {
        appState.currentSong = song;
        currentActiveSong = song; 
        this.currentSessionId = Date.now(); 
        this.audio.src = song.audioUrl;
        this.audio.load();
        updatePlayerUI(); 
    },

    play() {
        appState.isPlaying = true;
        isPlayingAudio = true; 
        this.audio.play();
        syncLiveUI(); 
    },

    pause() {
        appState.isPlaying = false;
        isPlayingAudio = false; 
        this.audio.pause();
        syncLiveUI(); 
    },

    togglePlay() {
        if (appState.isPlaying) this.pause();
        else this.play();
    },

    seek(time) {
        this.audio.currentTime = time;
        updateProgressUI();
    },

    handleEnded() {
        if (appState.settings.repeat) {
            this.currentSessionId = Date.now(); 
            this.seek(0);
            this.play();
        } else {
            this.next();
        }
    },

    next() {
        if (!currentPlaylistContext || currentPlaylistContext.length === 0) return;
        let idx = currentPlaylistContext.indexOf(appState.currentSong?.id);
        if (idx === -1) return;
        let nextIdx = appState.settings.shuffle ? Math.floor(Math.random() * currentPlaylistContext.length) : (idx + 1) % currentPlaylistContext.length;
        let nextSong = appState.songRegistry[currentPlaylistContext[nextIdx]];
        if (nextSong) {
            this.loadSong(nextSong);
            this.play();
        }
    },

    previous() {
        if (!currentPlaylistContext || currentPlaylistContext.length === 0) return;
        let idx = currentPlaylistContext.indexOf(appState.currentSong?.id);
        if (idx === -1) return;
        let prevIdx = (idx - 1 + currentPlaylistContext.length) % currentPlaylistContext.length;
        let prevSong = appState.songRegistry[currentPlaylistContext[prevIdx]];
        if (prevSong) {
            this.loadSong(prevSong);
            this.play();
        }
    },

    getCurrentTime() { return this.audio.currentTime || 0; },
    getDuration() { return this.audio.duration || 0; }
};

Player.init();

function updatePlayerUI() {
    const playerElement = document.querySelector('.player');
    if (playerElement) playerElement.classList.remove('player-hidden');

    document.getElementById("player-art").src = appState.currentSong.artwork || 'assets/images/default.png';
    document.getElementById("player-title").textContent = appState.currentSong.title;
    document.getElementById("player-artist").textContent = appState.currentSong.artist;

    updateHeartUI();
    syncLiveUI(); 
    
    const activeTab = document.querySelector('.tab.active'); 
    if (activeTab && activeTab.textContent === 'Lyrics') switchTab('lyrics', activeTab);
}

function syncLiveUI() {
    const playBtn = document.querySelector("#run");
    if (playBtn) {
        if (appState.isPlaying) {
            playBtn.classList.remove("fa-play", "fa-circle-play");
            playBtn.classList.add("fa-circle-pause");
        } else {
            playBtn.classList.remove("fa-circle-pause");
            playBtn.classList.add("fa-circle-play");
        }
    }
    
    document.querySelectorAll('.favorite-row').forEach(row => {
        const rowId = row.getAttribute('data-id');
        const eqDiv = row.querySelector('.track-eq');
        const numSpan = row.querySelector('.track-num');
        const bars = row.querySelectorAll('.eq-bar');
        const titleSpan = row.querySelector('.fav-title');
        
        if (appState.currentSong && rowId === appState.currentSong.id) {
            numSpan.style.display = 'none';
            eqDiv.style.display = 'flex';
            titleSpan.style.color = '#1ed760';
            bars.forEach(b => b.style.animationPlayState = appState.isPlaying ? 'running' : 'paused');
        } else {
            numSpan.style.display = 'inline-block';
            eqDiv.style.display = 'none';
            titleSpan.style.color = 'white';
        }
    });
}

function updateProgressUI() {
    if(controller) {
        controller.value = Player.getCurrentTime();
        updateSliderColor(); 
    }
    document.getElementById("current-time").innerText = formatTime(Player.getCurrentTime());
}
function PicChanger(event) {
    let currentTarget = event.currentTarget;
    let songId = currentTarget.getAttribute("data-id");
    let catId = currentTarget.getAttribute("data-category");
    let song = appState.songRegistry[songId];
    if (!song) return;

    // Strict contextual array binding
    if (catId === 'library') {
        currentPlaylistContext = localSongs.map(s => s.id);
    } else if (catId === 'added') {
        currentPlaylistContext = appState.library.addedSongs.map(s => s.id);
    } else if (catId && (homeCategories.find(c => c.id === catId) || catId === 'made-for-you')) {
        let cat = catId === 'made-for-you' ? madeForYou : homeCategories.find(c => c.id === catId);
        if (cat) currentPlaylistContext = cat.songs.map(s => s.id);
    } else {
        // Fallback for Search/Favorites
        currentPlaylistContext = Array.from(document.querySelectorAll('.song, .favorite-row, .recent-item'))
            .map(el => el.getAttribute('data-id'))
            .filter(id => id);
    }

    Player.loadSong(song);
    Player.play();
}

/* =========================================================
   CHAPTER 4: UI NAVIGATION & SEARCH
========================================================= */
async function triggerDynamicPersonalization() {
    let stats = appState?.library?.analytics;
    if (!stats || stats.totalPlays < 3) return;

    // Derive current dominant signals
    let topArtists = Object.entries(stats.artistPlays)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(a => a[0]);

    // Fetch pool logic (smart cache)
    for (let artist of topArtists) {
        if (!fetchedPersonalizedArtists.has(artist)) {
            fetchedPersonalizedArtists.add(artist);
            try {
                const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(artist)}`);
                if (response.ok) {
                    const data = await response.json();
                    data.forEach(apiSong => personalizedCandidatesPool.push(registerSong(normalizeITunesSong(apiSong))));
                }
            } catch (e) {}
        }
    }

    generateRecommendations(topArtists);

    // Dynamically rebuild the UI if the user is currently on the Home page
    const menuDiv = document.querySelector('.songs-menu');
    if (menuDiv && menuDiv.classList.contains("home-layout") && !menuDiv.classList.contains("d1") && !menuDiv.innerHTML.includes("SANGEET Library")) {
        addHomePage();
    }
}

function generateRecommendations(topArtistsList = []) {
    let stats = appState?.library?.analytics;
    if (!stats || stats.totalPlays < 3) return;

    let allCandidates = [];
    homeCategories.forEach(cat => allCandidates.push(...cat.songs));
    allCandidates.push(...personalizedCandidatesPool); 
    
    let uniqueCandidates = new Map();
    allCandidates.forEach(s => {
        // FIX: Strictly verify valid registry existence & playability
        if (s && s.id && s.audioUrl && appState.songRegistry[s.id]) {
            uniqueCandidates.set(s.id, s);
        }
    });

    let candidates = [];
    let favs = appState.library.favorites || [];
    let recents = appState.library.recentlyPlayed || [];

    uniqueCandidates.forEach(song => { 
        let score = 0;
        let nArtist = normalizeKey(song.artist);
        let nSongKey = `${song.artist} - ${song.title}`;
        
        if (favs.some(f => f.id === song.id)) score += 50;
        if (favs.some(f => normalizeKey(f.artist) === nArtist)) score += 20;
        
        // Safely check new normalized keys, falling back to old data to prevent breaking existing stats
        let artistPlays = stats.artistPlays[nArtist] || stats.artistPlays[song.artist] || 0;
        let songPlays = stats.songPlays[nSongKey] || stats.songPlays[song.title] || 0;

        score += (artistPlays * 8);
        score += (songPlays * 12);
        
        if (recents.includes(song.id)) score += 25;
        score += Math.floor(Math.random() * 5); 

        if (score > 5) candidates.push({ song, score });
    });

    candidates.sort((a, b) => b.score - a.score);

    let finalRecs = [];
    let artistCounts = {};
    
    for (let c of candidates) {
        let aName = normalizeKey(c.song.artist);
        let isTopArtist = topArtistsList.includes(aName);
        
        // FIX: Smart Diversity. Allow 4 tracks for dominant affinity, 1 track for random discovery.
        let limit = isTopArtist ? 4 : 1; 

        if ((artistCounts[aName] || 0) < limit) {
            finalRecs.push(c.song);
            artistCounts[aName] = (artistCounts[aName] || 0) + 1;
        }
        if (finalRecs.length >= 40) break; 
    }

    if (finalRecs.length >= 4) {
        madeForYou = { id: 'made-for-you', title: 'Made For You', songs: finalRecs };
    }
}

async function loadHomeSongs() {
    songsMenuDiv.classList.remove("d1", "d2", "d3", "home-layout");
    songsMenuDiv.innerHTML = `<h2 style="color: #aaa; margin-left: 20px; font-family: Verdana;"><i class="fa-solid fa-spinner fa-spin"></i> Loading Discover Catalog...</h2>`;
    
    try {
        const response = await fetch('http://localhost:3000/api/home');
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        
        if (data.success && data.categories) {
            homeCategories = data.categories.map(cat => {
                cat.songs = cat.songs.map(s => registerSong(s));
                return cat;
            });
            await triggerDynamicPersonalization(); 
        }
    } catch (error) {
        console.error("Discover Catalog Failed", error);
    }
    
    addHomePage();
}

function addHomePage() {
    songsMenuDiv.classList.remove("d1", "d2", "d3");
    songsMenuDiv.classList.add("home-layout");
    let htmlString = '';

    if (madeForYou) htmlString += renderCategoryPreview(madeForYou, "Based on what you've been listening to");
    
    if (homeCategories.length > 0) {
        homeCategories.forEach(cat => { htmlString += renderCategoryPreview(cat); });
    } else {
        htmlString += `<p style="color:#aaa; margin-left:30px; font-family:Verdana;">Discover feed temporarily unavailable.</p>`;
    }

    songsMenuDiv.innerHTML = htmlString;
}

// Artwork normalization and diversity filter for Home Previews
function getDiversePreview(songs, limit = 6) {
    let preview = [];
    let usedArtists = new Set();
    let usedArt = new Set();
    let remaining = [...songs];

    // iTunes CDN urls look like: .../image/thumb/Music.../source/300x300bb.jpg
    // By dropping the filename, we get the unique hash directory of the artwork.
    const normalizeArt = (url) => {
        if (!url) return 'default';
        let parts = url.split('/');
        parts.pop(); 
        return parts.join('/'); 
    };

    // Pass 1: Ideal candidates (Unique Artist AND Unique Artwork)
    for (let i = 0; i < remaining.length; i++) {
        let song = remaining[i];
        let artKey = normalizeArt(song.artwork);
        let artistKey = (song.artist || '').toLowerCase();

        if (!usedArtists.has(artistKey) && !usedArt.has(artKey)) {
            preview.push(song);
            usedArtists.add(artistKey);
            usedArt.add(artKey);
            remaining.splice(i, 1);
            i--; // Adjust index since we mutated the copied array
        }
        if (preview.length === limit) return preview;
    }

    // Pass 2: Relax artist diversity, enforce Unique Artwork
    for (let i = 0; i < remaining.length; i++) {
        let song = remaining[i];
        let artKey = normalizeArt(song.artwork);

        if (!usedArt.has(artKey)) {
            preview.push(song);
            usedArt.add(artKey);
            remaining.splice(i, 1);
            i--;
        }
        if (preview.length === limit) return preview;
    }

    // Pass 3: Fallback (Take whatever is left to guarantee the preview isn't empty)
    for (let i = 0; i < remaining.length; i++) {
        preview.push(remaining[i]);
        remaining.splice(i, 1);
        i--;
        if (preview.length === limit) return preview;
    }

    return preview;
}


function renderCategoryPreview(cat, subtitle = "") {
    let subset = getDiversePreview(cat.songs, 50);
    let subHtml = subtitle ? `<p style="color:#aaa; margin: 0 0 15px 15px;padding: 0; font-family:Verdana;letter-spacing:1px;">${subtitle}</p>` : '';

    let html = `
        <div class="home-section">
            <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 0 30px; box-sizing: border-box;">
                <h2 class="home-section-title" style="margin-bottom: 5px;">${cat.title}</h2>
                <span style="color: #aaa; cursor: pointer; font-family: Verdana; font-size: 0.85rem; flex-shrink: 0;" onclick="showCategory('${cat.id}')">See all <i class="fa-solid fa-arrow-right"></i></span>
            </div>
            ${subHtml}
            <div class="horizontal-shelf">
    `;
    subset.forEach(song => { 
    html += `<div class="song-card-wrapper">${createSongCardHTML(song, cat.id)}</div>`; 
});
  
 
    
    html += `</div></div>`;
    return html;
}

function showCategory(categoryId) {
    let cat = categoryId === 'made-for-you' ? madeForYou : homeCategories.find(c => c.id === categoryId);
    if (!cat) return;

    songsMenuDiv.classList.remove("d1", "d2", "d3");
    songsMenuDiv.classList.add("home-layout");

    let html = `
        <div class="home-section">
            <div style="padding: 20px 30px;">
                <h1 style="color: white; font-size: 2.5rem; text-align: left; margin: 0;">${cat.title}</h1>
                <button onclick="playPlaylistContext('${cat.id}')" style="margin-top: 15px; background: #edf4f0ff; border: none; padding: 10px 24px; border-radius: 20px; font-weight: bold; cursor: pointer;">
                    <i class="fa-solid fa-play"></i> Play Playlist
                </button>
            </div>
            <div class="song-grid">
    `;
    cat.songs.forEach(song => { html += createSongCardHTML(song, cat.id); });
    html += `</div></div>`;
    songsMenuDiv.innerHTML = html;
}

function playPlaylistContext(categoryId) {
    let cat = categoryId === 'made-for-you' ? madeForYou : homeCategories.find(c => c.id === categoryId);
    if (!cat || cat.songs.length === 0) return;

    showCategory(categoryId); // Render view

    currentPlaylistContext = cat.songs.map(s => s.id);
    let firstSong = appState.songRegistry[currentPlaylistContext[0]];
    if (firstSong) {
        Player.loadSong(firstSong);
        Player.play();
    }
}

function showLibrary() {
    songsMenuDiv.classList.remove("d1", "d2", "d3");
    songsMenuDiv.classList.add("home-layout");
    let html = `
        <div class="home-section">
            <div style="padding: 20px 30px;">
                <h1 style="color: wheat; font-size: 2.3rem; text-align: left;font-family: Verdana, sans-serif; margin: 0;">Library</h1>
                <p style="color: #aaa; text-align: left;margin-left: -5px; font-family: Verdana;">Your built-in full-length tracks.</p>
            </div>
            <div class="song-grid">
    `;
    localSongs.forEach(song => { html += createSongCardHTML(song, 'library'); });
    html += `</div></div>`;
    songsMenuDiv.innerHTML = html;
}
function createSongCardHTML(song, categoryId = "") {
    let badge = song.isPreview ? `<div class="preview-badge">30s Preview</div>` : '';
    return `
        <div class="song" data-id="${song.id}" data-category="${categoryId}" onclick="PicChanger(event)" oncontextmenu="addToQueue(event)">
            ${badge}
            <img src="${song.artwork}" id="image" alt="">
            <h1 title="${song.title}">${song.title}</h1>
            <p title="${song.artist}">${song.artist}</p>
        </div>
    `;
}

function search() {
    songsMenuDiv.classList.remove("d2", "d3", "home-layout");
    songsMenuDiv.classList.add("d1");
    songsMenuDiv.innerHTML = `
        <div class="searchBarDiv">
            <div class="searchBarBorder">
                <input type="search" id="searchBar" onkeydown="if(event.key === 'Enter') searchSong()" autocomplete="off" placeholder="Search for a song..." />
            </div>
        </div>
        <div class="songList song-grid"></div>
    `;
}

async function searchSong() {
    const searchBar = document.querySelector("#searchBar");
    const songList = document.querySelector(".songList");
    let value = searchBar.value.trim();
    if (!value) return;

    songList.innerHTML = '<h2 style="color: white; margin-left: 20px;">Searching...</h2>';

    try {
        const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(value)}`);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        songList.innerHTML = ''; 

        if (!data || data.length === 0) {
            songList.innerHTML = '<h2 style="color: white; margin-left: 20px;">No songs found!</h2>';
            return;
        }

        data.forEach(apiSong => {
            const song = registerSong(normalizeITunesSong(apiSong));
            songList.innerHTML += createSongCardHTML(song);
        });
    } catch (error) {
        songList.innerHTML = '<h2 style="color: red; margin-left: 20px;">Error connecting to backend.</h2>';
    }
}

function addSongs() {
    songsMenuDiv.classList.remove("d1", "d3", "home-layout");
    songsMenuDiv.classList.add("d2");
    songsMenuDiv.innerHTML = `
        <div class="borderForNewSong">
            <div class="newSong">
                <img src="assets/images/default1.jpg" id="newDefault">
                <h1 id="addedSongName">Song</h1>
                <p id="addedArtistName">Artist</p>
            </div>
        </div>
        <div class="essentials">
            <h1>Poster:</h1>
            <input type="file" class="choose-file" id="posterImage" accept="image/*" />
            <h1>Audio:</h1>
            <input type="file" class="choose-file" id="audioSong" accept="audio/*"/>   
            <h1>Song Name:</h1>
            <input type="text" class="songNamePad" id="songName" />
            <br>
            <h1>Artist Name:</h1>
            <input type="text" class="songNamePad" id="artistName" />
            <br>
            <div class="submitDiv">
                <button class="submit" onclick="save()">Submit</button>
            </div>
        </div>
    `;
}

async function save() {
    const poster = document.querySelector("#posterImage");
    const songAudio = document.querySelector("#audioSong");
    // ... (Keep existing declarations)
    if (songName.value !== "" && artistName.value !== "" && poster.files[0] && songAudio.files[0]) {
        const tempPoster = URL.createObjectURL(poster.files[0]);
        const tempAudio = URL.createObjectURL(songAudio.files[0]);

        newDefault.src = tempPoster;
        addedSongName.innerText = songName.value;
        addedArtistName.innerText = artistName.value;

        const songObj = normalizeImportedSong(songName.value, artistName.value, tempPoster, tempAudio);

        try {
            // FIX: Actually pass the raw files to DB!
            await IndexedDBManager.saveSong(songObj, songAudio.files[0], poster.files[0]);

            const song = registerSong(songObj);
            appState.library.addedSongs.push(song);
            if(typeof showToast !== 'undefined') showToast("Saved successfully!", "✅");
            else alert("Saved successfully!");

            poster.value = ""; songName.value = ""; artistName.value = ""; songAudio.value = "";
        } catch (e) {
            console.error("Save failed", e);
            alert("Failed to save to database.");
        }
    } else {
        alert("Fulfill all the requirements (including files)!");
    }
}


function addedSongs() {
    songsMenuDiv.classList.remove("d1", "d2", "home-layout");
    songsMenuDiv.innerHTML = `<div class="songList song-grid"></div>`;
    const grid = songsMenuDiv.querySelector('.song-grid');
    
    appState.library.addedSongs.forEach(song => {
    grid.innerHTML += createSongCardHTML(song, 'added');

    });
}
/* =========================================================
   CHAPTER 5: ANALYTICS & FAVORITES (STATE MIGRATED)
========================================================= */
function showAnalytics() {
    const mainContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');
    mainContainer.classList.remove("d2", "d3");
    mainContainer.classList.add("d1");

    let stats = appState.library.analytics;
    let topArtists = Object.entries(stats.artistPlays).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let topSongs = Object.entries(stats.songPlays).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const getSongImg = (title) => {
        let found = Object.values(appState.songRegistry).find(s => s.title === title);
        return found && found.artwork ? found.artwork : 'assets/images/default.png';
    };

    const getArtistImg = (artistName) => {
        stats.artistImages = stats.artistImages || {};
        if (stats.artistImages[artistName]) return stats.artistImages[artistName];

        let found = Object.values(appState.songRegistry).find(s => 
            s && s.artist && s.artist.toLowerCase().trim() === artistName.toLowerCase().trim()
        );

        if (found && found.artwork) {
            stats.artistImages[artistName] = found.artwork;
            localStorage.setItem("sangeet_analytics_v5", JSON.stringify(stats)); 
            return found.artwork;
        }
        return 'assets/images/default.png';
    };

    let html = `
        <div style="padding: 40px; padding-bottom: 120px; width: 100%; color: white; font-family: Verdana;">
            <h1 style="font-size: 2.5rem; letter-spacing: 2px; margin-bottom: 30px;">
                <i class="fa-solid fa-chart-line" style="color: palevioletred;"></i> Analytics
            </h1>
            
            <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
                    <h3 style="color: #aaa; margin: 0 0 10px 0;">Total Plays</h3>
                    <p style="font-size: 2.5rem; margin: 0; font-weight: bold; color: palevioletred;">${stats.totalPlays}</p>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
                    <h3 style="color: #aaa; margin: 0 0 10px 0;">Unique Songs</h3>
                    <p style="font-size: 2.5rem; margin: 0; font-weight: bold; color: #4facfe;">${stats.uniqueSongs}</p>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                    <h3 style="color: palevioletred; margin-top: 0; margin-bottom: 20px;">Top Tracks</h3>
                    ${topSongs.length === 0 ? '<p style="color: gray;">No data yet</p>' : topSongs.map((s, i) => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span style="color: #aaa; font-weight: bold; width: 20px;">#${i+1}</span>
                                <img src="${getSongImg(s[0])}" onerror="this.src='assets/images/default.png'" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
                                <span style="font-weight: bold;">${s[0]}</span>
                            </div>
                            <span style="color: palevioletred; font-weight: bold;">${s[1]}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                    <h3 style="color: #4facfe; margin-top: 0; margin-bottom: 20px;">Top Artists</h3>
                    ${topArtists.length === 0 ? '<p style="color: gray;">No data yet</p>' : topArtists.map((a, i) => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span style="color: #aaa; font-weight: bold; width: 20px;">#${i+1}</span>
                                <img src="${getArtistImg(a[0])}" onerror="this.src='assets/images/default.png'" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #333;">
                                <span style="font-weight: bold;">${a[0]}</span>
                            </div>
                            <span style="color: #4facfe; font-weight: bold;">${a[1]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    mainContainer.innerHTML = html;
}

function showFavorites() {
    const mainContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');
    mainContainer.classList.remove("d2", "d3","home-layout");
    mainContainer.classList.add("d1");

    let favoriteSongs = appState.library.favorites;
    let songCount = favoriteSongs.length;

    if (!document.getElementById("sangeet-animations")) {
        let style = document.createElement("style");
        style.id = "sangeet-animations";
        style.innerHTML = `@keyframes sangeetEq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } } .eq-bar { width: 3px; background-color: #1ed760; transform-origin: bottom; animation: sangeetEq 1s ease-in-out infinite; }`;
        document.head.appendChild(style);
    }

    let html = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; overflow-y: auto; background: linear-gradient(to bottom, #501124 0%, #0d1117 400px); color: white; padding-bottom: 120px;">
            <div style="display: flex; align-items: flex-end; padding: 60px 40px 30px 40px; gap: 30px;">
                <div style="width: 220px; height: 220px; background: linear-gradient(135deg, #ff0844 0%, #ffb199 100%); display: flex; justify-content: center; align-items: center; border-radius: 12px;">
                    <i class="fa-solid fa-heart" style="color: white; font-size: 7rem;"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <span style="font-size: 0.95rem; font-weight: 700; text-transform: uppercase; color: #ffb199;">Your Collection</span>
                    <h1 style="font-size: 5.5rem; margin: 0; font-weight: 900;">Liked Songs</h1>
                <div style="display: flex; align-items: center; gap: 20px;">
                    <p style="margin: 0; font-size: 1.1rem; color: #e2e8f0;"> <span style="color: #ff3366;">•</span> ${songCount} songs</p>

                    ${songCount > 0 ? `
                        <button onclick="playAllFavorites()" style="background: #eef3f0; color: black; border: none; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-play"></i> Play Playlist
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div style="padding: 0 40px;">
    `;
    
    if (songCount === 0) {
        html += `<p style="color: #a0aec0; font-size: 1.2rem; text-align: center; margin-top: 50px;">Songs you like will appear here.</p>`;
    } else {
        favoriteSongs.forEach((song, index) => {
            let isActive = appState.currentSong && appState.currentSong.id === song.id;
            let playState = (isActive && appState.isPlaying) ? "running" : "paused";

            html += `
                <div class="favorite-row" data-id="${song.id}" ondblclick="playFavoriteSong(${index})" style="display: flex; align-items: center; padding: 10px; border-radius: 8px; cursor: pointer; color: #a0aec0; gap: 15px; transition: background 0.2s;">
                    <div style="width: 30px;">
                        <span class="track-num" style="display: ${isActive ? 'none' : 'inline-block'};">${index + 1}</span>
                        <div class="track-eq" style="display: ${isActive ? 'flex' : 'none'}; gap: 2px; height: 14px; align-items: flex-end;">
                            <div class="eq-bar" style="height: 100%; animation-play-state: ${playState};"></div>
                            <div class="eq-bar" style="height: 80%; animation-play-state: ${playState};"></div>
                            <div class="eq-bar" style="height: 100%; animation-play-state: ${playState};"></div>
                        </div>
                    </div>
                    <div style="flex: 2; display: flex; align-items: center; gap: 15px;">
                        <img src="${song.artwork || 'assets/images/default.png'}" onerror="this.src='assets/images/default.png'" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover;" alt="cover">
                        <div style="display: flex; flex-direction: column;">
                            <span class="fav-title" style="color: ${isActive ? '#1ed760' : 'white'}; font-weight: bold;">${song.title}</span>
                            <span>${song.artist}</span>
                        </div>
                    </div>
                    <div style="width: 40px;" onclick="event.stopPropagation(); removeFavoriteFromList(${index})">
                        <i class="fa-solid fa-circle-check" style="color: #1ed760; font-size: 1.2rem;"></i>
                    </div>
                </div>
            `;
        });
    }
    html += `</div></div>`;
    mainContainer.innerHTML = html;
}

function toggleFavorite(targetId = null) {
    let idToToggle = targetId || (appState.currentSong ? appState.currentSong.id : null);
    if (!idToToggle) return alert("Play a song first!");
    
    let songObj = appState.songRegistry[idToToggle];
    if (!songObj) return;

    const existsIndex = appState.library.favorites.findIndex(song => song.id === idToToggle);
    
    if (existsIndex > -1) {
        appState.library.favorites.splice(existsIndex, 1); 
        if(typeof showToast !== 'undefined') showToast("Removed from Favorites", "💔");
    } else {
        appState.library.favorites.unshift(songObj);
        if(typeof showToast !== 'undefined') showToast("Added to Favorites", "❤️");
    }

    localStorage.setItem("sangeet_favs_v4", JSON.stringify(appState.library.favorites));
    
    if (appState.currentSong && appState.currentSong.id === idToToggle) updateHeartUI();

    const activeContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');
    if (activeContainer && activeContainer.innerHTML.includes("Liked Songs")) {
        showFavorites(); 
    }
    
    // Moved safely inside the function bounds!
    document.querySelectorAll('.song').forEach(card => {
        if (card.getAttribute('data-id') === idToToggle) {
            let btn = card.querySelector('.fav-btn');
            if (btn) btn.innerText = existsIndex > -1 ? '☆' : '★';
        }
    });
}

function updateHeartUI() {
    const heartBtn = document.getElementById("like-btn");
    if (!heartBtn || !appState.currentSong) return;
    let isFav = appState.library.favorites.some(song => song.id === appState.currentSong.id);
    heartBtn.className = isFav ? "fa-solid fa-heart player-heart" : "fa-regular fa-heart player-heart";
    heartBtn.style.color = "wheat";
}

function removeFavoriteFromList(index) {
    appState.library.favorites.splice(index, 1); 
    localStorage.setItem("sangeet_favs_v4", JSON.stringify(appState.library.favorites));
    updateHeartUI();
    showFavorites(); 
}

function playFavoriteSong(index) {
    let song = appState.library.favorites[index];
    if (!song || !song.audioUrl) return alert("Audio file missing!");
    
    Player.loadSong(song);
    Player.play();
}
function playAllFavorites() {
    let favorites = appState.library.favorites;
    if (!favorites || favorites.length === 0) return;
    // Set the global playlist context to your liked songs so Next/Prev works
    currentPlaylistContext = favorites.map(s => s.id);
    Player.loadSong(favorites[0]);
    Player.play();
}
/* =========================================================
   CHAPTER 6: UTILITY FUNCTIONS
========================================================= */
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    let min = Math.floor(seconds / 60);
    let sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

async function switchTab(tabName, element) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    const contentArea = document.getElementById("tab-content-area");

    if (tabName === 'lyrics') {
        if (!appState.currentSong) {
            contentArea.innerHTML = "<p>Play a song to see lyrics.</p>";
            return;
        }

        const title = appState.currentSong.title;
        const artist = appState.currentSong.artist;

        contentArea.innerHTML = "<p style='font-family: Verdana;'>Fetching lyrics...</p>";

        try {
            // PHASE 5: Fetch from our own backend instead of LRCLIB directly
            const url = `http://localhost:3000/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error("Backend connection failed");
            
            const data = await response.json();

            // Normalized response handling
            if (data.found && data.lyrics) {
                const formattedLyrics = data.lyrics.replace(/\n/g, '<br>');
                contentArea.innerHTML = `<div class="lyrics-display">${formattedLyrics}</div>`;
            } else {
                contentArea.innerHTML = "<p style='font-family: Verdana;'>No lyrics available for this track.</p>";
            }
        } catch (error) {
            contentArea.innerHTML = "<p style='font-family: Verdana;'>Couldn't connect to server.</p>";
        }
        
    } else if (tabName === 'queue') {
        if (appState.queue.length === 0) {
            contentArea.innerHTML = "<p style='font-family: Verdana;'>Up next: Autoplay<br>(Queue is empty)</p>";
        } else {
            let queueHtml = "<div style='text-align: left; padding: 0 10px; font-family: Verdana; color: wheat;'>";
            appState.queue.forEach((song, i) => {
                queueHtml += `<p>${i + 1}. ${song.title} - ${song.artist}</p>`;
            });
            queueHtml += "</div>";
            contentArea.innerHTML = queueHtml;
        }
    } else if (tabName === 'details') {
        contentArea.innerHTML = `<p>High Quality Audio (320kbps)</p>`;
    }
}

function manual() {
    if (Player.audio && controller) {
        Player.seek(controller.value);
    }
}

function updateSliderColor() {
    if (controller && Player.getDuration() > 0) {
        const percentage = (Player.getCurrentTime() / Player.getDuration()) * 100;
        controller.style.background = `linear-gradient(to right, wheat ${percentage}%, #333 ${percentage}%)`;
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const playerTitle = document.getElementById("player-title");
    const playerTextContainer = document.querySelector(".player-text"); 

    if (!playerTitle || !playerTextContainer) return;

    function updatePlayerTitleScroll() {
        // Calculate the hidden overflow amount
        const overflow = playerTitle.scrollWidth - playerTitle.clientWidth;

        if (overflow > 5) {
            playerTitle.style.setProperty("--scroll-distance", `${overflow}px`);
            const duration = Math.max(3, overflow / 15); // Smooth dynamic speed
            playerTitle.style.setProperty("--scroll-duration", `${duration}s`);
            playerTitle.classList.add("scrolling");
        }
    }

    // Trigger animation when hovering the stable parent container
    playerTextContainer.addEventListener("mouseenter", updatePlayerTitleScroll);

    playerTextContainer.addEventListener("mouseleave", () => {
        playerTitle.classList.remove("scrolling");
    });

    // Reset layout safely when a new song loads
    const observer = new MutationObserver(() => {
        playerTitle.classList.remove("scrolling");
    });

    observer.observe(playerTitle, {
        childList: true,
        characterData: true,
        subtree: true
    });
});
function exitApp() {
    // 1. Stop any currently playing audio
    if (typeof Player !== 'undefined' && Player.audio) {
        Player.pause();
    }
    
    // 2. Attempt to close the browser tab
    window.close();
    
    // 3. Fallback: If the browser blocks window.close(), show a clean exit screen
    setTimeout(() => {
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: black; color: white; font-family: Verdana;">
                <h1 style="font-size: 4rem; color: wheat; letter-spacing: 15px; margin-bottom: 20px;">SANGEET</h1>
                <p style="color: #aaa; font-size: 1.2rem;">Playback stopped. You can now safely close this tab.</p>
            </div>
        `;
    }, 200);
}