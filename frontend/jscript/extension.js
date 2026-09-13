// extension.js - Unified with Central Player API
(function(){
    document.addEventListener('DOMContentLoaded', initExtension);

    function $all(s){ return Array.from(document.querySelectorAll(s)); }
    function $id(i){ return document.getElementById(i); }

    let dark = JSON.parse(localStorage.getItem('mp_dark')) || false;
    let favorites = JSON.parse(localStorage.getItem('mp_favorites_v4') || "[]");

    function initExtension(){
        addFavoriteButtons();
        createControlBar();
        applyDarkMode(dark);
        console.log('Extension loaded: favorites, dark mode, voice commands mapped to Player API');
    }

    /* ----------------- Favorites ----------------- */
    function addFavoriteButtons(){
        $all('.song').forEach((songDiv) => {
            if (songDiv.querySelector('.fav-btn')) return;
            const songId = songDiv.getAttribute('data-id');
            const btn = document.createElement('button');
            btn.className = 'fav-btn';
            btn.title = 'Like / Favorite';
            
            // Check central state on render
            let isFav = typeof appState !== 'undefined' && appState.library.favorites.some(f => f.id === songId);
            btn.innerText = isFav ? '★' : '☆';
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof toggleFavorite !== 'undefined') toggleFavorite(songId); // Route to Central API
            });
            
            btn.style.position = 'absolute';
            btn.style.right = '8px';
            btn.style.top = '8px';
            btn.style.padding = '4px 6px';
            btn.style.border = 'none';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            songDiv.style.position = songDiv.style.position || 'relative';
            songDiv.appendChild(btn);
        });
    }
    /* ----------------- Control bar UI ----------------- */
    function createControlBar(){
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'extension-controls';
        controlsContainer.innerHTML = `
            <button id="ext-liked" title="Show Liked Songs">Liked</button>
            <button id="ext-shuffle" title="Toggle Shuffle">Shuffle</button>
            <button id="ext-repeat" title="Toggle Repeat">Repeat</button>
            <button id="ext-dark" title="Toggle Dark Mode">Dark</button>
            <button id="ext-voice" title="Voice">Voice</button>
            <div id="ext-voice-status" style="display:inline-block;margin-left:8px;font-size:12px"></div>
        `;
        Object.assign(controlsContainer.style, {
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 999999,
            display: 'flex',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(6px)'
        });
        document.body.appendChild(controlsContainer);

        updateShuffleButton();
        updateRepeatButton();
        updateDarkButton();

        $id('ext-liked').addEventListener('click', showLikedSongs);
        
        $id('ext-shuffle').addEventListener('click', () => {
            if (typeof appState !== 'undefined') {
                appState.settings.shuffle = !appState.settings.shuffle;
                if(typeof showToast !== 'undefined') {
                    showToast(appState.settings.shuffle ? "Shuffle Enabled" : "Shuffle Disabled", appState.settings.shuffle ? "🔀" : "❌");
                }
                updateShuffleButton();
            }
        });

        $id('ext-repeat').addEventListener('click', () => {
            if (typeof appState !== 'undefined') {
                appState.settings.repeat = !appState.settings.repeat;
                updateRepeatButton();
            }
        });
        
        $id('ext-dark').addEventListener('click', () => {
            dark = !dark;
            localStorage.setItem('mp_dark', JSON.stringify(dark));
            applyDarkMode(dark);
            updateDarkButton();
            if (typeof showToast !== 'undefined') showToast(dark ? "Dark Mode Enabled" : "Light Mode Enabled", dark ? "🌙" : "☀️");
        });

        $id('ext-voice').addEventListener('click', toggleVoiceRecognition);
    }

    function updateShuffleButton(){
        const b = $id('ext-shuffle');
        if (!b || typeof appState === 'undefined') return;
        b.style.fontWeight = appState.settings.shuffle ? '700' : '400';
        b.style.background = appState.settings.shuffle ? '#ffd70033' : 'transparent';
    }
    
    function updateRepeatButton(){
        const b = $id('ext-repeat');
        if (!b || typeof appState === 'undefined') return;
        b.innerText = 'Repeat: ' + (appState.settings.repeat ? 'On' : 'Off');
    }
    
    function updateDarkButton(){
        const b = $id('ext-dark');
        if (!b) return;
        b.innerText = dark ? 'Light' : 'Dark';
    }

    function applyDarkMode(on){
        if (on) document.body.classList.add('ext-dark-mode');
        else document.body.classList.remove('ext-dark-mode');
    }

    function showLikedSongs(){
        const modal = document.createElement('div');
        modal.className = 'ext-modal';
        modal.innerHTML = `<div class="ext-modal-inner"><h3>Liked Songs</h3><div class="ext-list"></div><button id="ext-close">Close</button></div>`;
        document.body.appendChild(modal);
        const list = modal.querySelector('.ext-list');
        
        if (favorites.length === 0){
            list.innerHTML = '<p>No liked songs yet</p>';
        } else {
            favorites.forEach(id => {
                let displayTitle = id;
                if (typeof appState !== 'undefined' && appState.songRegistry[id]) {
                    displayTitle = `${appState.songRegistry[id].title} - ${appState.songRegistry[id].artist}`;
                }

                const entry = document.createElement('div');
                entry.className = 'ext-entry';
                entry.innerText = displayTitle;
                entry.style.cursor = 'pointer';
                entry.addEventListener('click', () => {
                    if (typeof appState !== 'undefined' && appState.songRegistry[id] && typeof Player !== 'undefined') {
                        Player.loadSong(appState.songRegistry[id]);
                        Player.play();
                    }
                    modal.remove();
                });
                list.appendChild(entry);
            });
        }
        modal.querySelector('#ext-close').addEventListener('click', () => modal.remove());
    }

    /* ----------------- Voice Recognition ----------------- */
    let recognizing = false;
    let recognition;
    
    function toggleVoiceRecognition(){
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){
            alert('Speech Recognition not supported in this browser.');
            return;
        }
        if (!recognition){
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SR();
            recognition.continuous = false;
            recognition.lang = 'en-IN';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.onresult = (e) => {
                const text = e.results[0][0].transcript.trim().toLowerCase();
                const status = $id('ext-voice-status');
                if (status) status.innerText = 'Heard: ' + text;
                handleVoiceCommand(text);
            };
            recognition.onend = () => { recognizing = false; const b=$id('ext-voice'); if(b) b.innerText='Voice'; };
            recognition.onerror = (e) => { console.error(e); recognizing = false; const b=$id('ext-voice'); if(b) b.innerText='Voice'; };
        }
        if (recognizing){
            recognition.stop();
            recognizing = false;
            const b=$id('ext-voice'); if(b) b.innerText='Voice';
            const status = $id('ext-voice-status'); if(status) status.innerText = '';
        } else {
            recognition.start();
            recognizing = true;
            const b=$id('ext-voice'); if(b) b.innerText='Listening...';
        }
    }

    function handleVoiceCommand(text){
        if (!text || typeof Player === 'undefined' || typeof appState === 'undefined') return;
        
        if (text.includes('play next') || text.includes('next song') || text.includes('skip')){ Player.next(); return; }
        if (text.includes('previous') || text.includes('play previous') || text.includes('last song') || text.includes('go back')){ Player.previous(); return; }
        if (text.includes('pause') || text.includes('stop')){ Player.pause(); return; }
        
        if (text.includes('play') && (text.includes('play ') || text.match(/^play$/)) ){
            if (text.trim() === 'play' || text.trim() === 'resume'){ 
                Player.play();
                return;
            }
            
            const playMatch = text.match(/play (.+)/);
            if (playMatch){
                const q = playMatch[1].trim().toLowerCase();
                let bestMatchId = null;
                let bestScore = 0;
                
                Object.values(appState.songRegistry).forEach(songData => {
                    const title = songData.title.toLowerCase();
                    const artist = songData.artist.toLowerCase();
                    const score = (title.includes(q) ? 2 : 0) + (artist.includes(q) ? 1 : 0);
                    if (score > bestScore){ 
                        bestMatchId = songData.id; 
                        bestScore = score; 
                    }
                });
                
                if (bestMatchId) { 
                    Player.loadSong(appState.songRegistry[bestMatchId]);
                    Player.play();
                    return; 
                }
            }
        }
        
        if (text.includes('volume up') || text.includes('increase volume')){ Player.audio.volume = Math.min(1, Player.audio.volume + 0.1); return; }
        if (text.includes('volume down') || text.includes('decrease volume') || text.includes('lower volume')){ Player.audio.volume = Math.max(0, Player.audio.volume - 0.1); return; }
        
        if (text.includes('shuffle on') || text.includes('enable shuffle') || (text.includes('shuffle') && text.includes('on'))){
            appState.settings.shuffle = true; updateShuffleButton(); return;
        }
        if (text.includes('shuffle off') || text.includes('disable shuffle') || (text.includes('shuffle') && text.includes('off'))){
            appState.settings.shuffle = false; updateShuffleButton(); return;
        }
        if (text.includes('dark') || text.includes('dark mode')){ dark = true; localStorage.setItem('mp_dark', JSON.stringify(dark)); applyDarkMode(true); updateDarkButton(); return; }
        if (text.includes('light') || text.includes('light mode')){ dark = false; localStorage.setItem('mp_dark', JSON.stringify(dark)); applyDarkMode(false); updateDarkButton(); return; }
        if (text.includes('like') || text.includes('favorite') || text.includes('save this')){
            if (typeof toggleFavorite !== 'undefined') toggleFavorite();
            return;
        }
    }
})();