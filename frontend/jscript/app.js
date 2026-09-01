/* =========================================================
   CHAPTER 1: CENTRAL STATE & GLOBAL VARIABLES
========================================================= */
const appState = {
    currentSong: null,
    isPlaying: false,
    playback: {
        currentTime: 0,
        duration: 0
    },
    settings: {
        shuffle: false,
        repeat: false,
        darkMode: true
    },
    queue: [],
    library: {
        favorites: JSON.parse(localStorage.getItem("sangeet_favs_v3")) || [],
        recentlyPlayed: JSON.parse(localStorage.getItem("sangeet_recent")) || [],
        addedSongs: []
    }
};

// LEGACY ALIASES
let currentActiveSong = appState.currentSong;      
let isPlayingAudio = appState.isPlaying;           
let trash = "0"; 
let p = 0, b = 0;
let music, a, storeSetInterval;

const controller = document.querySelector(".slider");
const songsMenuDiv = document.querySelector('.songs-menu');
if(controller) controller.value = 0;

// STATE LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("shuffle-btn")?.addEventListener("click", function() {
        appState.settings.shuffle = this.classList.contains("active");
    });
    document.getElementById("repeat-btn")?.addEventListener("click", function() {
        appState.settings.repeat = this.classList.contains("active");
    });
});

/* =========================================================
   CHAPTER 2: SONG DATABASE
========================================================= */
const songs = [
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
    { name: "Can’t Help Falling in Love", singer: "Elvis Presley", poster: "assets/images/cant_help_falling_in_love.jpg", audio: "assets/audio/cant_help_falling_in_love.mp3" },
    { name: "capital", singer: "nanku", poster: "assets/images/capital.jpg", audio: "assets/audio/capital.mp3" },
    { name: "101", singer: "seedhe maut", poster: "assets/images/101.jpg", audio: "assets/audio/101.mp3" },
    { name: "11k", singer: "seedhe maut", poster: "assets/images/11k.jpg", audio: "assets/audio/11k.mp3" },
    { name: "heeriye", singer: "nanku", poster: "assets/images/heeriye.jpg", audio: "assets/audio/heeriye.mp3" },
    { name: "kamikaze", singer: "nanku", poster: "assets/images/kamikaze.jpg", audio: "assets/audio/kamikaze.mp3" },
    { name: "namastute", singer: "seedhe maut", poster: "assets/images/namastute.jpg", audio: "assets/audio/namastute.mp3" },
    { name: "aajkal", singer: "nanku", poster: "assets/images/aajkal.jpg", audio: "assets/audio/aajkal.mp3" },
    { name: "nanchaku", singer: "mc stan", poster: "assets/images/nanchaku.jpg", audio: "assets/audio/nanchaku.mp3" }
];

/* =========================================================
   CHAPTER 3: CORE AUDIO ENGINE (STATE MIGRATED)
========================================================= */
function PicChanger(event) {
    const playerElement = document.querySelector('.player');
    if (playerElement) playerElement.classList.remove('player-hidden');

    let currentTarget = p === 1 ? event : event.currentTarget;
    let ClickedDiv = currentTarget.querySelector('img');
    
    if (appState.isPlaying && music) music.pause();        
    
    music = currentTarget.querySelector('audio');
    a = ClickedDiv.src.toString(); 

    appState.currentSong = {
        id: `${currentTarget.querySelector("h1")?.textContent} — ${currentTarget.querySelector("p")?.textContent}`,
        title: currentTarget.querySelector("h1")?.textContent || "Unknown Title",
        artist: currentTarget.querySelector("p")?.textContent || "Unknown Artist",
        cover: a,
        audioUrl: music.src
    };
    currentActiveSong = appState.currentSong; 
    updateHeartUI();

    document.getElementById("player-art").src = appState.currentSong.cover;
    document.getElementById("player-title").textContent = appState.currentSong.title;
    document.getElementById("player-artist").textContent = appState.currentSong.artist;

    const playBtn = document.querySelector("#run");
    if(playBtn) {
        playBtn.classList.remove("fa-play", "fa-circle-play");
        playBtn.classList.add("fa-circle-pause");
    }
    
    appState.isPlaying = true;
    trash = "1"; 
    isPlayingAudio = true; 

   if (songsMenuDiv && songsMenuDiv.innerHTML.includes("Liked Songs")) {
        showFavorites();
    }


    music.play();
    
    clearInterval(storeSetInterval);
    setTimeout(() => { 
        if(controller) controller.max = music.duration; 
        document.getElementById("total-time").innerText = formatTime(music.duration);
    }, 150); 
    
    storeSetInterval = setInterval(() => {
        if(controller) {
            controller.value = music.currentTime;
            updateSliderColor(); 
        }
        document.getElementById("current-time").innerText = formatTime(music.currentTime);
        
        if (controller && controller.value >= (music.duration - 1)) {
            if (appState.settings.repeat) {
                music.currentTime = 0;
                music.play();
            } else {
                changeSong('next');
            }
        }
    }, 500);

    p = 0; 
    const lyricsTabElement = document.querySelector('.tab'); 
    if (lyricsTabElement) switchTab('lyrics', lyricsTabElement);
}

function pause() {
    const playBtn = document.querySelector("#run");
    if (!playBtn) return;

    if (appState.isPlaying) {
        playBtn.classList.remove("fa-circle-pause");
        playBtn.classList.add("fa-circle-play");
        if(music) music.pause();
        
        appState.isPlaying = false;
        trash = "0";
        isPlayingAudio = false;
    } else {
        playBtn.classList.remove("fa-circle-play");
        playBtn.classList.add("fa-circle-pause");
        if(music) music.play();
        
        appState.isPlaying = true;
        trash = "1";
        isPlayingAudio = true;
    }
    if (songsMenuDiv && songsMenuDiv.innerHTML.includes("Liked Songs")) {
        showFavorites();
    }
}

function manual() {
    clearInterval(storeSetInterval);
    if(music && controller) {
        music.currentTime = controller.value;
        updateSliderColor(); 
        
        storeSetInterval = setInterval(() => {
            controller.value = music.currentTime;
            updateSliderColor();
            document.getElementById("current-time").innerText = formatTime(music.currentTime);
            
            if (music.currentTime >= (music.duration - 1)) {
                if (appState.settings.repeat) {
                    music.currentTime = 0;
                    music.play();
                } else {
                    changeSong('next');
                }
            }
        }, 500);
    }
}

function changeSong(direction) {
    const allSongsArray = document.querySelectorAll(".song");

    if (direction === 'next' && appState.settings.shuffle) {
        let randomIndex = Math.floor(Math.random() * allSongsArray.length);
        p = 1;
        PicChanger(allSongsArray[randomIndex]);
        return; 
    }

    for (let index = 0; index < allSongsArray.length; index++) {
        let element = allSongsArray[index];
        let x = element.querySelector('img');
        if (x && a === x.src.toString()) {
            if (direction === 'next' && index < allSongsArray.length - 1) {
                p = 1;
                PicChanger(allSongsArray[index + 1]);
                break;
            } else if (direction === 'prev' && index > 0) {
                p = 1;
                PicChanger(allSongsArray[index - 1]);
                break;
            }
        }
    }
}

/* =========================================================
   CHAPTER 4: UI NAVIGATION & SEARCH
========================================================= */
function addHomePage() {
    songsMenuDiv.classList.remove("d1", "d2", "d3");
    let htmlString = `<div class="songs-menu">`;
    songs.forEach(song => {
        htmlString += `
            <div class="song" onclick="PicChanger(event)">
                <img src="${song.poster}" id="image" alt="">
                <h1>${song.name}</h1>
                <p>${song.singer}</p>
                <audio src="${song.audio}" id="song"></audio>
            </div>
        `;
    });
    htmlString += `</div>`;
    songsMenuDiv.innerHTML = htmlString;
}

function search() {
    songsMenuDiv.classList.remove("d2", "d3");
    songsMenuDiv.classList.add("d1");
    songsMenuDiv.innerHTML = `
        <div class="searchBarDiv">
            <div class="searchBarBorder">
                <input type="search" id="searchBar" onkeydown="if(event.key === 'Enter') searchSong()" autocomplete="off" placeholder="Search for a song..." />
            </div>
        </div>
        <div class="songList"></div>
    `;
    b = 0;
}

async function searchSong() {
    const searchBar = document.querySelector("#searchBar");
    const songList = document.querySelector(".songList");
    let value = searchBar.value.trim();
    if (!value) return;

    songList.innerHTML = '<h2 style="color: white; margin-left: 20px;">Searching...</h2>';

    try {
        const response = await fetch(`http://localhost:3000/api/search?q=${value}`);
        const data = await response.json();
        songList.innerHTML = ''; 

        if (!data || data.length === 0) {
            songList.innerHTML = '<h2 style="color: white; margin-left: 20px;">No songs found!</h2>';
            return;
        }

        data.forEach(song => {
            const searchedSongDiv = document.createElement("div");
            searchedSongDiv.className = "song";
            searchedSongDiv.innerHTML = `
                <img src="${song.album?.cover_medium || 'assets/images/default.png'}" id="image" alt="cover">
                <h1>${song.title}</h1>
                <p>${song.artist?.name || 'Unknown Artist'}</p>
                <audio src="${song.preview}" id="song"></audio>
            `;
            
            searchedSongDiv.addEventListener('click', (event) => {
                PicChanger(event);
                const artistName = song.artist?.name || 'Unknown Artist';
                let stats = JSON.parse(localStorage.getItem("sangeet_stats")) || {};
                stats[artistName] = (stats[artistName] || 0) + 1;
                localStorage.setItem("sangeet_stats", JSON.stringify(stats));
            });
            
            songList.appendChild(searchedSongDiv);
        });
        b = 1;
    } catch (error) {
        songList.innerHTML = '<h2 style="color: red; margin-left: 20px;">Error connecting to backend.</h2>';
    }
}

function addSongs() {
    songsMenuDiv.classList.remove("d1", "d3");
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

function save() {
    const poster = document.querySelector("#posterImage");
    const songAudio = document.querySelector("#audioSong");
    const songName = document.querySelector("#songName");
    const artistName = document.querySelector("#artistName");
    const newDefault = document.querySelector("#newDefault");
    const addedSongName = document.querySelector("#addedSongName");
    const addedArtistName = document.querySelector("#addedArtistName");

    if (songName.value !== "" && artistName.value !== "" && poster.files[0] && songAudio.files[0]) {
        newDefault.src = URL.createObjectURL(poster.files[0]);
        addedSongName.innerText = songName.value;
        addedArtistName.innerText = artistName.value;
        
        const newSong = {
            name: songName.value,
            singer: artistName.value,
            poster: newDefault.src,
            audio: URL.createObjectURL(songAudio.files[0]),
        };
        
        // MIGRATION: Push directly to appState
        appState.library.addedSongs.push(newSong);
        alert("Saved successfully!");
        
        poster.value = "";
        songName.value = "";
        artistName.value = "";
        songAudio.value = "";
    } else {
        alert("Fulfill all the requirements (including files)!");
    }
}

function addedSongs() {
    songsMenuDiv.classList.remove("d1", "d2");
    songsMenuDiv.innerHTML = ``;
    
    // MIGRATION: Read directly from appState
    appState.library.addedSongs.forEach(song => {
        let div = document.createElement("div");
        div.className = "song";
        div.innerHTML = `
            <img src="${song.poster}" id="image" alt="">
            <h1>${song.name}</h1>
            <p>${song.singer}</p>
            <audio src="${song.audio}" id="song"></audio>
        `;
        div.addEventListener('click', (event) => PicChanger(event));
        songsMenuDiv.appendChild(div);
    });
    b = 1;
}

/* =========================================================
   CHAPTER 5: ANALYTICS & FAVORITES (STATE MIGRATED)
========================================================= */
function showAnalytics() {
    songsMenuDiv.classList.remove("d2", "d3");
    songsMenuDiv.classList.add("d1");

    let stats = JSON.parse(localStorage.getItem("sangeet_stats")) || {};
    let sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    let html = `
        <div style="padding: 40px; padding-bottom: 120px; width: 100%;">
            <h1 style="color: white; font-size: 2.5rem; letter-spacing: 2px; margin-bottom: 30px; text-align: left;">
                <i class="fa-solid fa-chart-line" style="color: palevioletred;"></i> Your Listening Analytics
            </h1>
    `;
    
    if (sortedStats.length === 0) {
        html += `<p style="color: gray; font-size: 1.2rem;">You haven't played any songs yet.</p>`;
    } else {
        html += `<div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; width: 80%; border: 1px solid rgba(255,255,255,0.1);">`;
        sortedStats.forEach((stat, index) => {
            let medal = index === 0 ? '👑' : `#${index + 1}`;
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: white;">
                    <span style="font-size: 1.2rem; font-weight: bold;">${medal} &nbsp;&nbsp; ${stat[0]}</span>
                    <span style="color: palevioletred; font-size: 1.2rem; font-weight: bold;">${stat[1]} Plays</span>
                </div>
            `;
        });
        html += `</div>`;
    }
    html += `</div>`;
    songsMenuDiv.innerHTML = html;
}

function showFavorites() {
    const mainContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');
    mainContainer.classList.remove("d2", "d3");
    mainContainer.classList.add("d1");

    let favoriteSongs = appState.library.favorites;
    let songCount = favoriteSongs.length;

    if (!document.getElementById("sangeet-animations")) {
        let style = document.createElement("style");
        style.id = "sangeet-animations";
        style.innerHTML = `
            @keyframes sangeetEq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
            .eq-bar { width: 3px; background-color: #1ed760; transform-origin: bottom; animation: sangeetEq 1s ease-in-out infinite; }
        `;
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
                    <p style="margin: 0; font-size: 1.1rem; color: #e2e8f0;">User <span style="color: #ff3366;">•</span> ${songCount} songs</p>
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
                <div ondblclick="playFavoriteSong(${index})" style="display: flex; align-items: center; padding: 10px; border-radius: 8px; cursor: pointer; color: #a0aec0; gap: 15px;">
                    <div style="width: 30px;">
                        <span class="track-num" style="display: ${isActive ? 'none' : 'inline-block'};">${index + 1}</span>
                        <div class="track-eq" style="display: ${isActive ? 'flex' : 'none'}; gap: 2px; height: 14px; align-items: flex-end;">
                            <div class="eq-bar" style="height: 100%; animation-play-state: ${playState};"></div>
                            <div class="eq-bar" style="height: 80%; animation-play-state: ${playState};"></div>
                            <div class="eq-bar" style="height: 100%; animation-play-state: ${playState};"></div>
                        </div>
                    </div>
                    <div style="flex: 2; display: flex; align-items: center; gap: 15px;">
                        <img src="${song.cover || 'assets/images/default.png'}" style="width: 45px; height: 45px; border-radius: 6px;" alt="cover">
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: ${isActive ? '#1ed760' : 'white'}; font-weight: bold;">${song.title}</span>
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

function toggleFavorite() {
    if (!appState.currentSong) return alert("Play a song first!");
    
    const existsIndex = appState.library.favorites.findIndex(song => song.id === appState.currentSong.id);
    
    if (existsIndex > -1) {
        appState.library.favorites.splice(existsIndex, 1); 
    } else {
        appState.library.favorites.unshift({ 
            ...appState.currentSong, 
            dateAdded: new Date().toLocaleDateString() 
        });
    }

    localStorage.setItem("sangeet_favs_v3", JSON.stringify(appState.library.favorites));
    updateHeartUI();
    if (document.querySelector('.songList')?.innerHTML.includes("Liked Songs")) showFavorites();
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
    localStorage.setItem("sangeet_favs_v3", JSON.stringify(appState.library.favorites));
    updateHeartUI();
    showFavorites(); 
}

function playFavoriteSong(index) {
    let song = appState.library.favorites[index];
    if (!song || !song.audioUrl) return alert("Audio file missing!");
    
    let ghostDeck = document.getElementById("ghost-deck") || document.createElement("div");
    ghostDeck.id = "ghost-deck";
    ghostDeck.style.display = "none";
    if (!document.getElementById("ghost-deck")) document.body.appendChild(ghostDeck);

    ghostDeck.innerHTML = `
        <div class="song" id="active-ghost-card">
            <img src="${song.cover}" id="image" alt="cover">
            <h1>${song.title}</h1>
            <p>${song.artist}</p>
            <audio src="${song.audioUrl}" id="song"></audio>
        </div>
    `;
    p = 1; 
    PicChanger(document.getElementById("active-ghost-card")); 
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
        const title = document.getElementById("player-title").textContent;
        const artist = document.getElementById("player-artist").textContent;

        if (title === "Song Title" || title === "Unknown Title") {
            contentArea.innerHTML = "<p>Play a song to see lyrics.</p>";
            return;
        }

        contentArea.innerHTML = "<p style='font-family: Verdana;'>Fetching lyrics from LRCLIB...</p>";

        try {
            const cleanTitle = title.split('-')[0].split('(')[0].split('[')[0].trim();
            const cleanArtist = artist.split(',')[0].split('&')[0].split(/feat\.?/i)[0].split(/ft\.?/i)[0].trim();

            const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.length > 0 && data[0].plainLyrics) {
                const formattedLyrics = data[0].plainLyrics.replace(/\n/g, '<br>');
                contentArea.innerHTML = `<div class="lyrics-display">${formattedLyrics}</div>`;
            } else {
                contentArea.innerHTML = "<p style='font-family: Verdana;'>No lyrics available for this track.</p>";
            }
        } catch (error) {
            contentArea.innerHTML = "<p style='font-family: Verdana;'>Couldn't connect to LRCLIB database.</p>";
        }
        
    } else if (tabName === 'queue') {
        // MIGRATION: Map directly to appState.queue
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
} // <-- This closing brace was missing

function updateSliderColor() {
    if (music && controller && music.duration) {
        const percentage = (music.currentTime / music.duration) * 100;
        controller.style.background = `linear-gradient(to right, wheat ${percentage}%, #333 ${percentage}%)`;
    }
}