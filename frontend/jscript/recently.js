// recently.js — Gutted tracking logic; pure rendering UI
(function () {
    document.addEventListener("DOMContentLoaded", initRecently);

    function initRecently() {
        injectSidebarButton();
        console.log("Recently Played Loaded (Pure UI Mode)");
    }

    function injectSidebarButton() {
        const sidebar = document.querySelector(".left") || document.querySelector(".menu") || document.querySelector(".options");
        if (!sidebar) return;
        const btn = document.createElement("div");
        btn.className = sidebar.querySelector("div, .option, .item")?.className || "";
        btn.id = "recently-btn";
        btn.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i> Recently Played`;

        const exitBtn = Array.from(sidebar.children).find(x => x.innerText.toLowerCase().includes("exit"));
        if (exitBtn) sidebar.insertBefore(btn, exitBtn);
        else sidebar.appendChild(btn);

        btn.onclick = () => showRecentlyPlayed();
    }

    function showRecentlyPlayed() {
        const mainContainer = typeof songsMenuDiv !== 'undefined' ? songsMenuDiv : document.querySelector('.songList');
        mainContainer.classList.remove("d2", "d3");
        mainContainer.classList.add("d1");

        let recentSongIds = appState.library.recentlyPlayed;

        let html = `
            <div style="padding: 40px; padding-bottom: 120px; width: 100%;">
                <h1 style="color: white; font-size: 2.5rem; letter-spacing: 2px; margin-bottom: 30px; text-align: left;">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #4facfe;"></i> Listening History
                </h1>
        `;
        
        if (recentSongIds.length === 0) {
            html += `<p style="color: gray; font-size: 1.2rem; font-family: cursive;">You haven't listened to any tracks yet!</p>`;
        } else {
            html += `<div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; width: 80%; border: 1px solid rgba(255,255,255,0.1);">`;
            
            recentSongIds.forEach((id) => {
                let song = appState.songRegistry[id];
                if (!song) return; // Failsafe for deleted IDs
                
                html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: white; font-family: Verdana; gap: 20px; min-width: 0;">
                    <span style="font-size: 1.2rem; font-weight: bold; color: #fff; flex: 1; min-width: 0; line-height: 1.4; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <img src="${song.artwork}" style="width: 30px; height: 30px; border-radius: 4px; vertical-align: middle; margin-right: 15px;">
                        ${song.title}
                    </span>
                    <span style="color: #aaa; font-size: 1.1rem; font-style: italic; max-width: 40%; text-align: right; line-height: 1.4; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        by ${song.artist}
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

