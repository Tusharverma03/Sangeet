// extension.js - Robust controls: favorites, shuffle, repeat, dark, voice
(function(){
    document.addEventListener('DOMContentLoaded', initExtension);

    function $all(s){ return Array.from(document.querySelectorAll(s)); }
    function $id(i){ return document.getElementById(i); }

    let songs = [];
    let shuffle = JSON.parse(localStorage.getItem('mp_shuffle')) || false;
    let repeatMode = localStorage.getItem('mp_repeat') || 'none'; // 'none' | 'one' | 'all'
    let dark = JSON.parse(localStorage.getItem('mp_dark')) || false;
    let favorites = JSON.parse(localStorage.getItem('mp_favorites') || "[]");
    let shuffledOrder = [];
    // canonical current index stored by extension (keeps state even if audio nodes change)
    window.__mp_current_index = window.__mp_current_index || -1;

    function initExtension(){
        songs = $all('.song');
        // give each song a stable data-index attribute
        songs.forEach((s,i) => { s.dataset.extIndex = i; });

        addFavoriteButtons();
        createControlBar();
        applyDarkMode(dark);
        overrideControls();
        attachSongClickHandlers();
        attachEndedHandlers();
        if (shuffle) buildShuffledOrder();
        console.log('Extension loaded: favorites, shuffle, repeat, dark, voice');
    }

    /* ----------------- Favorites ----------------- */
    function addFavoriteButtons(){
        songs.forEach((songDiv, idx) => {
            if (songDiv.querySelector('.fav-btn')) return;
            const btn = document.createElement('button');
            btn.className = 'fav-btn';
            btn.title = 'Like / Favorite';
            btn.innerText = favorites.includes(getSongId(songDiv)) ? '★' : '☆';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(songDiv, btn);
            });
            // style safe inline minimal to avoid theme issues
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

    function getSongId(songDiv){
        const title = songDiv.querySelector('h1')?.innerText.trim() || '';
        const artist = songDiv.querySelector('p')?.innerText.trim() || '';
        return title + ' — ' + artist;
    }

    function toggleFavorite(songDiv, btn){
    const id = getSongId(songDiv);
    const idx = favorites.indexOf(id);
    if (idx === -1){
        favorites.push(id);
        btn.innerText = '★';
        showToast("Added to Favorites", "❤️");
    } else {
        favorites.splice(idx,1);
        btn.innerText = '☆';
        showToast("Removed from Favorites", "💔");
    }
    localStorage.setItem('mp_favorites', JSON.stringify(favorites));
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
        // floating top-right - rely on CSS (extension.css) but enforce minimal fallback
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
    shuffle = !shuffle;
    localStorage.setItem('mp_shuffle', JSON.stringify(shuffle));
    if (shuffle) {
        buildShuffledOrder();
        showToast("Shuffle Enabled", "🔀");
    } else {
        showToast("Shuffle Disabled", "❌");
    }
    updateShuffleButton();
});

        $id('ext-repeat').addEventListener('click', () => {
            if (repeatMode === 'none') repeatMode = 'all';
            else if (repeatMode === 'all') repeatMode = 'one';
            else repeatMode = 'none';
            localStorage.setItem('mp_repeat', repeatMode);
            updateRepeatButton();
        });
        $id('ext-dark').addEventListener('click', () => {
    dark = !dark;
    localStorage.setItem('mp_dark', JSON.stringify(dark));
    applyDarkMode(dark);
    updateDarkButton();

    if (dark) showToast("Dark Mode Enabled", "🌙");
    else showToast("Light Mode Enabled", "☀️");
});

        $id('ext-voice').addEventListener('click', toggleVoiceRecognition);
    }

    function updateShuffleButton(){
        const b = $id('ext-shuffle');
        if (!b) return;
        b.style.fontWeight = shuffle ? '700' : '400';
        b.style.background = shuffle ? '#ffd70033' : 'transparent';
    }
    function updateRepeatButton(){
        const b = $id('ext-repeat');
        if (!b) return;
        b.innerText = 'Repeat: ' + (repeatMode==='none'? 'Off' : repeatMode==='one' ? 'One' : 'All');
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
        if (favorites.length===0){
            list.innerHTML = '<p>No liked songs yet</p>';
        } else {
            favorites.forEach(id => {
                const entry = document.createElement('div');
                entry.className = 'ext-entry';
                entry.innerText = id;
                entry.style.cursor = 'pointer';
                entry.addEventListener('click', () => {
                    const songDiv = songs.find(s => getSongId(s)===id);
                    if (songDiv) playIndex(parseInt(songDiv.dataset.extIndex,10));
                    modal.remove();
                });
                list.appendChild(entry);
            });
        }
        modal.querySelector('#ext-close').addEventListener('click', () => modal.remove());
    }

    /* ----------------- Navigation logic ----------------- */
    function overrideControls(){
        const forward = $id('forward');
        const backward = $id('backward');
        if (forward){
            forward.removeAttribute('onclick');
            forward.addEventListener('click', (e) => {
                e.preventDefault();
                playNext();
            });
        }
        if (backward){
            backward.removeAttribute('onclick');
            backward.addEventListener('click', (e) => {
                e.preventDefault();
                playPrev();
            });
        }
    }

    function buildShuffledOrder(){
        shuffledOrder = songs.map((_,i)=>i);
        for (let i = shuffledOrder.length-1; i>0; i--){
            const j = Math.floor(Math.random()*(i+1));
            [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
        }
        // if current index exists, rotate the shuffled order so current is first
        if (window.__mp_current_index >= 0){
            const pos = shuffledOrder.indexOf(window.__mp_current_index);
            if (pos > 0){
                const head = shuffledOrder.splice(0,pos);
                shuffledOrder = shuffledOrder.concat(head);
            }
        }
    }

    function findCurrentIndex(){
        // Primary: use extension-tracked index
        if (typeof window.__mp_current_index === 'number' && window.__mp_current_index >= 0 && window.__mp_current_index < songs.length){
            return window.__mp_current_index;
        }
        // Fallback: compare active audio src
        const audios = Array.from(document.querySelectorAll('audio'));
        const active = audios.find(a => !a.paused) || audios.find(a => a.currentTime>0);
        if (!active) return -1;
        const activeSrc = active.currentSrc || active.src;
        for (let i=0;i<songs.length;i++){
            const a = songs[i].querySelector('audio');
            if (!a) continue;
            // compare by file name (handles relative/absolute)
            const srcA = a.src || a.currentSrc || '';
            if (!srcA) continue;
            if (activeSrc.endsWith(srcA.split('/').pop()) || srcA.endsWith(activeSrc.split('/').pop()) || srcA === activeSrc){
                return i;
            }
        }
        return -1;
    }

    function playIndex(i){
        if (i<0 || i>=songs.length) return;
        window.__mp_current_index = i;
        const songDiv = songs[i];
        // attempt to click the original song div (this triggers original player logic)
        songDiv.click();
        // small fallback: if original logic expects a different element, try to find audio and play
        setTimeout(()=>{
            const a = songDiv.querySelector('audio');
            if (a && a.paused) {
                try { a.play(); } catch(e) {}
            }
        }, 120);
    }

    function playNext(){
        const cur = findCurrentIndex();
        let next = -1;
        if (shuffle){
            if (!shuffledOrder || shuffledOrder.length===0) buildShuffledOrder();
            if (cur === -1) next = shuffledOrder[0];
            else {
                const pos = shuffledOrder.indexOf(cur);
                if (pos === -1) {
                    // current not in shuffled order: choose first unused
                    next = shuffledOrder[0];
                } else {
                    next = (pos === shuffledOrder.length - 1) ? shuffledOrder[0] : shuffledOrder[pos+1];
                }
            }
        } else {
            next = (cur === -1) ? 0 : cur + 1;
            if (next >= songs.length){
                if (repeatMode === 'all') next = 0;
                else { /* end reached */ return; }
            }
        }
        if (next !== -1) playIndex(next);
    }

    function playPrev(){
        const cur = findCurrentIndex();
        let prev = -1;
        if (shuffle){
            if (!shuffledOrder || shuffledOrder.length===0) buildShuffledOrder();
            const pos = shuffledOrder.indexOf(cur);
            if (pos <= 0) prev = shuffledOrder[shuffledOrder.length - 1];
            else prev = shuffledOrder[pos - 1];
        } else {
            prev = (cur <= 0) ? 0 : cur - 1;
        }
        if (prev !== -1) playIndex(prev);
    }

    /* ----------------- Playback observation ----------------- */
    function attachSongClickHandlers(){
        songs.forEach((s,i)=>{
            // preserve existing click behavior but also update index for extension
            s.addEventListener('click', () => {
                window.__mp_current_index = parseInt(s.dataset.extIndex,10);
                // ensure shuffled order remains valid when user selects manual song
                if (shuffle) buildShuffledOrder();
            });
            // if song audio elements are clicked directly (some UI might play audio link)
            const a = s.querySelector('audio');
            if (a){
                a.addEventListener('play', () => {
                    window.__mp_current_index = parseInt(s.dataset.extIndex,10);
                });
            }
        });
    }

    function attachEndedHandlers(){
        // attach to every audio element present now and also watch for future audio elements
        const attachTo = (audio) => {
            if (audio.__ext_attached) return;
            audio.__ext_attached = true;
            audio.addEventListener('ended', () => {
                if (repeatMode === 'one'){
                    // replay same track
                    audio.currentTime = 0;
                    audio.play();
                } else {
                    playNext();
                }
            });
        };
        $all('audio').forEach(attachTo);

        // mutation observer: when DOM changes and new audio nodes are added, attach to them
        const mo = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.addedNodes && m.addedNodes.length){
                    m.addedNodes.forEach(n => {
                        if (n.nodeType === 1 && n.tagName.toLowerCase() === 'audio') attachTo(n);
                        // if entire song div added
                        if (n.nodeType === 1 && n.querySelectorAll) {
                            n.querySelectorAll('audio').forEach(attachTo);
                        }
                    });
                }
            });
        });
        mo.observe(document.body, { childList: true, subtree: true });
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
        if (!text) return;
        if (text.includes('play next') || text.includes('next song') || text.includes('skip')){ playNext(); return; }
        if (text.includes('previous') || text.includes('play previous') || text.includes('last song') || text.includes('go back')){ playPrev(); return; }
        if (text.includes('pause') || text.includes('stop')){ 
            const music = document.querySelector('audio:not([paused])');
            if (music) music.pause(); 
            return;
        }
        if (text.includes('play') && (text.includes('play ') || text.match(/^play$/)) ){
            // If user said "play" alone -> resume
            if (text.trim() === 'play' || text.trim() === 'resume'){ 
                const music = document.querySelector('audio');
                if (music) music.play();
                return;
            }
            // else try "play <song name>"
            const playMatch = text.match(/play (.+)/);
            if (playMatch){
                const q = playMatch[1].trim().toLowerCase();
                let best = -1, bestScore = 0;
                songs.forEach((s,i)=>{
                    const title = (s.querySelector('h1')?.innerText||'').toLowerCase();
                    const artist = (s.querySelector('p')?.innerText||'').toLowerCase();
                    const score = (title.includes(q)?2:0) + (artist.includes(q)?1:0);
                    if (score>bestScore){ best = i; bestScore = score; }
                });
                if (best !== -1) { playIndex(best); return; }
            }
        }
        if (text.includes('volume up') || text.includes('increase volume')){ changeVolumeBy(0.1); return; }
        if (text.includes('volume down') || text.includes('decrease volume') || text.includes('lower volume')){ changeVolumeBy(-0.1); return; }
        if (text.includes('shuffle on') || text.includes('enable shuffle') || (text.includes('shuffle') && text.includes('on'))){
            shuffle = true; localStorage.setItem('mp_shuffle', JSON.stringify(shuffle)); buildShuffledOrder(); updateShuffleButton(); return;
        }
        if (text.includes('shuffle off') || text.includes('disable shuffle') || (text.includes('shuffle') && text.includes('off'))){
            shuffle = false; localStorage.setItem('mp_shuffle', JSON.stringify(shuffle)); updateShuffleButton(); return;
        }
        if (text.includes('dark') || text.includes('dark mode')){ dark = true; localStorage.setItem('mp_dark', JSON.stringify(dark)); applyDarkMode(true); updateDarkButton(); return; }
        if (text.includes('light') || text.includes('light mode')){ dark = false; localStorage.setItem('mp_dark', JSON.stringify(dark)); applyDarkMode(false); updateDarkButton(); return; }
        if (text.includes('like') || text.includes('favorite') || text.includes('save this')){
            const cur = findCurrentIndex();
            if (cur !== -1){
                const sd = songs[cur];
                const btn = sd.querySelector('.fav-btn');
                if (btn) toggleFavorite(sd, btn);
            }
            return;
        }
    }

    function changeVolumeBy(delta){
        const music = document.querySelector('audio');
        if (!music) return;
        let v = music.volume + delta;
        v = Math.max(0, Math.min(1, v));
        music.volume = v;
    }

})();



