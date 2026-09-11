const parallax = document.getElementById("header");

let ticking = false;

window.addEventListener("scroll", () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const offset = window.scrollY;

            // Much smaller movement on mobile
            const speed = window.innerWidth <= 1000 ? 0.25 : 0.9;

            parallax.style.backgroundPositionY = `${offset * speed}px`;

            ticking = false;
        });

        ticking = true;
    }
}, { passive: true });