// shortcuts.js — Mapped to Central Player API
(function(){
  document.addEventListener('DOMContentLoaded', initShortcuts);

  function $id(id){ return document.getElementById(id); }

  function initShortcuts(){
    window.addEventListener('keydown', keyHandler, {passive:true});
    setupMediaSession();
    console.log('Shortcuts loaded: Space(play/pause), ←/→ prev/next, L like, S shuffle, R repeat, D dark');
  }

  function keyHandler(e){
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.code === 'Space'){ 
      e.preventDefault();
      if (typeof Player !== 'undefined') Player.togglePlay();
      updateMediaMetadata();
    } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight'){
      e.preventDefault();
      if (typeof Player !== 'undefined') Player.next();
    } else if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft'){
      e.preventDefault();
      if (typeof Player !== 'undefined') Player.previous();
    } else if (e.key.toLowerCase() === 'l'){ 
      if (typeof toggleFavorite !== 'undefined') toggleFavorite();
    } else if (e.key.toLowerCase() === 's'){ 
      const shuffleBtn = $id('ext-shuffle');
      if (shuffleBtn) shuffleBtn.click();
    } else if (e.key.toLowerCase() === 'r'){ 
      const repeatBtn = $id('ext-repeat');
      if (repeatBtn) repeatBtn.click();
    } else if (e.key.toLowerCase() === 'd'){ 
      const darkBtn = $id('ext-dark');
      if (darkBtn) darkBtn.click();
    }
  }

  function setupMediaSession(){
    if (!('mediaSession' in navigator)) return;
    updateMediaMetadata();

    navigator.mediaSession.setActionHandler('play', function(){ if (typeof Player !== 'undefined') Player.play(); });
    navigator.mediaSession.setActionHandler('pause', function(){ if (typeof Player !== 'undefined') Player.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', function(){ if (typeof Player !== 'undefined') Player.previous(); });
    navigator.mediaSession.setActionHandler('nexttrack', function(){ if (typeof Player !== 'undefined') Player.next(); });
    
    setInterval(updateMediaMetadata, 1000);
  }

  function updateMediaMetadata(){
    if (!('mediaSession' in navigator) || typeof appState === 'undefined' || !appState.currentSong) return;

    try{
      navigator.mediaSession.metadata = new MediaMetadata({
        title: appState.currentSong.title,
        artist: appState.currentSong.artist,
        artwork: [{ src: appState.currentSong.artwork, sizes: '300x300', type: 'image/jpeg' }]
      });
    }catch(e){ }
  }
})();