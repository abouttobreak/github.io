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
const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;

if (mouse) {
  const cursor = document.querySelector(".cursor");
  const ease = 0.50;                    // 0.05 = floaty, 0.3 = snappy, 1 = no smoothing
  let tx = 0, ty = 0;                   // target (real pointer)
  let x = 0, y = 0;                     // rendered position
  let raf = 0, started = false;

  const tick = () => {
    x += (tx - x) * ease;
    y += (ty - y) * ease;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    // stop the loop once it has caught up
    raf = (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) ? requestAnimationFrame(tick) : 0;
  };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;

    if (!started) { x = tx; y = ty; started = true; }   // first move: jump there, don't fly in from the corner
    if (!raf) raf = requestAnimationFrame(tick);

    cursor.setAttribute("data-visible", "");
    cursor.toggleAttribute("data-hidden", !!e.target.closest?.('[data-cursor="hide"]'));
    cursor.toggleAttribute("data-hover", !!e.target.closest?.("a, button, [role='button'], [data-cursor='hover']"));
  });

  const hide = () => { cursor.removeAttribute("data-visible"); started = false; };
  document.documentElement.addEventListener("pointerleave", hide);
  addEventListener("blur", hide);
}