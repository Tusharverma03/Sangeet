// shortcuts.js — Keyboard shortcuts + Media Session integration
(function(){
  document.addEventListener('DOMContentLoaded', initShortcuts);

  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function $id(id){ return document.getElementById(id); }

  function initShortcuts(){
    window.addEventListener('keydown', keyHandler, {passive:true});
    setupMediaSession();
    console.log('Shortcuts loaded: Space(play/pause), ←/→ prev/next, L like, S shuffle, R repeat, D dark');
  }

  // try to find currently playing audio or the first audio
  function currentAudio(){
    const audios = $all('audio');
    let a = audios.find(x => !x.paused && !isNaN(x.currentTime)) || audios[0] || null;
    return a;
  }

  // simulate clicking a song element by index
  function clickSongByIndex(i){
    const songs = $all('.song');
    if (!songs || !songs[i]) return;
    songs[i].click();
  }

  // helper: find index of active song by comparing audio elements
  function activeIndex(){
    const audios = $all('audio');
    const active = audios.find(a => !a.paused) || audios.find(a => a.currentTime > 0);
    if (!active) return -1;
    const songs = $all('.song');
    for (let i=0;i<songs.length;i++){
      const a = songs[i].querySelector('audio');
      if (!a) continue;
      // compare by file name suffix (robust for relative/absolute)
      const srcA = (a.src || '').split('/').pop();
      const srcActive = (active.src || active.currentSrc || '').split('/').pop();
      if (srcA && srcActive && (srcA === srcActive)) return i;
    }
    return -1;
  }

  function keyHandler(e){
    // avoid typing in inputs
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.code === 'Space'){ // Play/Pause
      e.preventDefault();
      const a = currentAudio();
      if (!a) return;
      if (a.paused) a.play();
      else a.pause();
      updateMediaMetadata();
    } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight'){
      e.preventDefault();
      // trigger forward button if present
      const forward = $id('forward');
      if (forward) forward.click();
      else { // fallback: find next song
        const idx = activeIndex();
        if (idx >= 0) clickSongByIndex(idx+1);
      }
    } else if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft'){
      e.preventDefault();
      const back = $id('backward');
      if (back) back.click();
      else {
        const idx = activeIndex();
        if (idx >= 0) clickSongByIndex(Math.max(0, idx-1));
      }
    } else if (e.key.toLowerCase() === 'l'){ // Like current
      const idx = activeIndex();
      if (idx>=0){
        const sd = $all('.song')[idx];
        const btn = sd.querySelector('.fav-btn');
        if (btn) btn.click();
      }
    } else if (e.key.toLowerCase() === 's'){ // Shuffle toggle (uses ext control if present)
      const shuffleBtn = $id('ext-shuffle');
      if (shuffleBtn) shuffleBtn.click();
    } else if (e.key.toLowerCase() === 'r'){ // Repeat toggle
      const repeatBtn = $id('ext-repeat');
      if (repeatBtn) repeatBtn.click();
    } else if (e.key.toLowerCase() === 'd'){ // Dark toggle
      const darkBtn = $id('ext-dark');
      if (darkBtn) darkBtn.click();
    }
  }

  /* Media Session API: updates metadata and handles media keys */
  function setupMediaSession(){
    if (!('mediaSession' in navigator)) return;
    updateMediaMetadata();

    navigator.mediaSession.setActionHandler('play', function(){ const a = currentAudio(); if (a) a.play(); });
    navigator.mediaSession.setActionHandler('pause', function(){ const a = currentAudio(); if (a) a.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', function(){ const back = document.getElementById('backward'); if (back) back.click(); });
    navigator.mediaSession.setActionHandler('nexttrack', function(){ const f = document.getElementById('forward'); if (f) f.click(); });
    
    // periodically update metadata (in case user changes song)
    setInterval(updateMediaMetadata, 1000);
  }

  function updateMediaMetadata(){
    if (!('mediaSession' in navigator)) return;
    const idx = activeIndex();
    const songs = $all('.song');
    if (idx < 0 || !songs[idx]) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const songDiv = songs[idx];
    const title = songDiv.querySelector('h1')?.innerText || 'Unknown';
    const artist = songDiv.querySelector('p')?.innerText || '';
    const imgEl = songDiv.querySelector('img');
    const artwork = imgEl ? [{ src: imgEl.src, sizes: '300x300', type: 'image/jpeg' }] : [];

    try{
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        artwork
      });
    }catch(e){ /* some browsers may throw */ }
  }

})();
