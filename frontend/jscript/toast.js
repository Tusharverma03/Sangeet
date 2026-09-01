// toast.js — Floating Toast Notifications (No original-code editing)

(function () {

    document.addEventListener("DOMContentLoaded", initToastSystem);

    function initToastSystem() {
        // Create container for toasts
        const container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);

        console.log("Toast Notification System Loaded");
    }

    // Global function — can be called from ANY script
    window.showToast = function (message, emoji = "🔔") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `${emoji} ${message}`;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add("show"), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 2600);
    };

})();
