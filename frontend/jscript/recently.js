// recently.js — Migrated to Central appState

(function () {

    document.addEventListener("DOMContentLoaded", initRecently);

    let maxItems = 100; // Tracks your last 100 songs!

    function initRecently() {
        injectSidebarButton();
        attachListeners();
        console.log("Recently Played Loaded (State Migrated Version)");
    }

    /* -----------------------------------------
       1. CREATE SIDEBAR BUTTON
    ------------------------------------------ */
    function injectSidebarButton() {
        const sidebar = document.querySelector(".left") || 
                        document.querySelector(".menu") || 
                        document.querySelector(".options");

        if (!sidebar) return;

        const sample = sidebar.querySelector("div, .option, .item");
        const className = sample ? sample.className : "";

        const btn = document.createElement("div");
        btn.className = className;
        btn.id = "recently-btn";
        btn.innerHTML = `
            <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i>
            Recently Played
        `;

        const exitBtn = Array.from(sidebar.children)
            .find(x => x.innerText.toLowerCase().includes("exit"));

        if (exitBtn) sidebar.insertBefore(btn, exitBtn);
        else sidebar.appendChild(btn);

        btn.onclick = () => {
            showRecentlyPlayed();
        };
    }

    /* -----------------------------------------
       2. ATTACH PLAY LISTENERS
    ------------------------------------------ */
    function attachListeners() {
        document.addEventListener("play", (event) => {
            if (event.target && event.target.tagName.toLowerCase() === "audio") {
                handlePlay(event.target);
            }
        }, true);
    }

    /* -----------------------------------------
       3. ADD TO HISTORY & ANALYTICS (STATE MIGRATED)
    ------------------------------------------ */
    function handlePlay(audio) {
        let id, artist;

        // STATE HYDRATION: Pull cleanly from appState if available, fallback to DOM
        if (typeof appState !== 'undefined' && appState.currentSong) {
            id = appState.currentSong.id;
            artist = appState.currentSong.artist;
        } else {
            const card = audio.closest(".song");
            if (!card) return;
            const title = card.querySelector("h1")?.innerText || "Unknown";
            artist = card.querySelector("p")?.innerText || "";
            id = `${title} — ${artist}`;
        }

        if (!id) return;

        // MIGRATION: Update central state array directly
        let list = appState.library.recentlyPlayed;
        
        // Remove duplicate if it exists, then push to top
        list = list.filter(x => x !== id); 
        list.unshift(id);
        if (list.length > maxItems) list.pop();
        
        // Reassign and sync down to storage cache
        appState.library.recentlyPlayed = list;
        localStorage.setItem("sangeet_recent", JSON.stringify(list));

        // Analytics Logic 
        if (artist) {
            let stats = JSON.parse(localStorage.getItem("sangeet_stats") || "{}");
            stats[artist] = (stats[artist] || 0) + 1;
            localStorage.setItem("sangeet_stats", JSON.stringify(stats));
        }
    }

    /* -----------------------------------------
       4. SHOW MAIN DASHBOARD (STATE MIGRATED)
    ------------------------------------------ */
    function showRecentlyPlayed() {
        const mainContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');

        if(mainContainer.classList.contains("d2")) mainContainer.classList.remove("d2");
        if(mainContainer.classList.contains("d3")) mainContainer.classList.remove("d3");
        mainContainer.classList.add("d1");

        // MIGRATION: Read directly from appState
        let recentSongs = appState.library.recentlyPlayed;

        let html = `
            <div style="padding: 40px; padding-bottom: 120px; width: 100%;">
                <h1 style="color: white; font-size: 2.5rem; letter-spacing: 2px; margin-bottom: 30px; text-align: left;">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #4facfe;"></i> Recently Played History
                </h1>
        `;
        
        if (recentSongs.length === 0) {
            html += `<p style="color: gray; font-size: 1.2rem; font-family: cursive;">You haven't listened to any tracks yet!</p>`;
        } else {
            html += `<div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; width: 80%; border: 1px solid rgba(255,255,255,0.1);">`;
            
            recentSongs.forEach((songString) => {
                let parts = songString.split(" — ");
                let songTitle = parts[0] || "Unknown Track";
                let artistName = parts[1] || "Unknown Artist";
                
                html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: white; font-family: Verdana; gap: 20px; min-width: 0;">
                    <span style="font-size: 1.2rem; font-weight: bold; color: #fff; flex: 1; min-width: 0; line-height: 1.4; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <i class="fa-solid fa-music" style="color: #4facfe; margin-right: 15px; font-size: 1rem; flex-shrink: 0;"></i> ${songTitle}
                    </span>
                    <span style="color: #aaa; font-size: 1.1rem; font-style: italic; max-width: 40%; text-align: right; line-height: 1.4; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        by ${artistName}
                    </span>
                </div>
            `;
            });
            html += `</div>`;
        }

        html += `</div>`;
        mainContainer.innerHTML = html;
    }

})();