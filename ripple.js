/*
 * - Reads the picture from #header's CSS background-image, so it follows style.css.
 * - Matches `background-size: cover; background-position: top` and also follows the
 *   scroll parallax from main.js (it reads header.style.backgroundPositionY).
 * - Only runs on desktop with a mouse; touch, narrow screens, reduced-motion and
 *   browsers without WebGL keep the plain CSS background.
 */
(() => {
  const header = document.getElementById("header");
  if (!header) return;
  if (!matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Feel of the effect (same values as the original)
  const FOLLOW = 0.075, RISE = 0.07, FALL = 0.028, TRAIL = 9, TRAIL_FOLLOW = 0.19, DPR_MAX = 2.25;

  const style = document.createElement("style");
  style.textContent = `
    #header.ripple-on { position: relative; isolation: isolate; }
    #header .ripple-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1;
      pointer-events: none; opacity: 0; transition: opacity 0.45s cubic-bezier(0.44, 0, 0.56, 1);
    }
    #header .ripple-canvas[data-drawn] { opacity: 1; }`;
  document.head.append(style);

  const VERTEX = `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

  const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D image;
uniform vec2 resolution, imageSize, mouse;
uniform vec2 trail[${TRAIL}];
uniform float strength, time, offsetY;

// Same mapping as CSS: background-size: cover, centred horizontally, top-aligned plus offsetY px, repeating vertically.
vec2 coverUv(vec2 uv) {
  vec2 p = vec2(uv.x, 1.0 - uv.y) * resolution;
  float s = max(resolution.x / imageSize.x, resolution.y / imageSize.y);
  vec2 drawn = imageSize * s;
  vec2 origin = vec2((resolution.x - drawn.x) * 0.5, offsetY);
  vec2 iuv = (p - origin) / drawn;
  iuv.y = fract(iuv.y);
  return vec2(iuv.x, 1.0 - iuv.y);
}
void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 delta = (uv - mouse) * aspect;
  float dist = length(delta);
  float falloff = (1.0 - smoothstep(0.0, 0.47, dist)) * strength;
  vec2 dir = delta / (dist + 0.0001);
  vec2 tangent = vec2(-dir.y, dir.x);
  float wave = sin(dist * 38.0 - time * 2.15) * falloff;
  float secondary = sin(dist * 19.0 + time * 0.7) * falloff;
  vec2 displacement = dir * (wave * 0.00525 + falloff * 0.004) + tangent * secondary * 0.001875;
  vec2 sampleUv = coverUv(uv + displacement);
  vec2 rgbShift = dir * (falloff * 0.0016 + abs(wave) * 0.0012);
  vec3 color = vec3(texture2D(image, sampleUv + rgbShift).r, texture2D(image, sampleUv).g,
                    texture2D(image, sampleUv - rgbShift).b);
  float glow = falloff * (0.10 + 0.08 * (sin(dist * 28.0 - time * 1.5) * 0.5 + 0.5));
  float trailGlow = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    float d = length((uv - trail[i]) * aspect);
    float age = 1.0 - float(i) / ${TRAIL}.0;
    float shimmer = 0.82 + 0.18 * sin(time * 2.0 - float(i) * 0.72);
    trailGlow += (exp(-d * d * 145.0) * 0.48 + exp(-d * d * 420.0) * 0.28) * age * age * shimmer;
  }
  trailGlow = min(trailGlow, 1.35) * strength * smoothstep(0.035, 0.105, dist);
  color += vec3(0.82) * glow;
  color += vec3(0.9) * trailGlow * 0.46;
  color += vec3(1.0) * pow(trailGlow, 1.65) * 0.11;
  gl_FragColor = vec4(color, 1.0);
}`;

  // The picture the CSS is already showing
  const match = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(header).backgroundImage);
  if (!match) return;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => start(image);
  image.onerror = () => console.warn("ripple: could not load", match[1]);
  image.src = match[1];

  function start(image) {
    const canvas = document.createElement("canvas");
    canvas.className = "ripple-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
    if (!gl) return;
    if (Math.max(image.naturalWidth, image.naturalHeight) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return;

    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return console.warn("ripple:", gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const [key, value] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
                                [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) {
      gl.texParameteri(gl.TEXTURE_2D, key, value);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    } catch (error) {
      return console.warn("ripple:", error); // cross-origin picture without CORS
    }

    const u = {};
    for (const name of ["resolution", "imageSize", "mouse", "trail", "strength", "time", "offsetY"]) u[name] = gl.getUniformLocation(program, name);
    gl.uniform2f(u.imageSize, image.naturalWidth, image.naturalHeight);

    header.classList.add("ripple-on");
    header.prepend(canvas);

    const target = { x: 0.5, y: 0.5, strength: 0 };
    const current = { x: 0.5, y: 0.5, strength: 0 };
    const trail = new Float32Array(TRAIL * 2).fill(0.5);
    let raf = 0, last = 0, visible = true, dpr = 1;
    const request = () => { if (!raf) raf = requestAnimationFrame(draw); };

    function draw(now) {
      raf = 0;
      if (canvas.width < 2 || canvas.height < 2) return;
      const dt = last ? Math.min(64, now - last) : 16.667;
      last = now;
      const k = (share) => 1 - Math.pow(1 - share, dt / 16.667); // frame-rate independent easing
      current.x += (target.x - current.x) * k(FOLLOW);
      current.y += (target.y - current.y) * k(FOLLOW);
      current.strength += (target.strength - current.strength) * k(target.strength ? RISE : FALL);
      let leaderX = current.x, leaderY = current.y;
      for (let i = 0; i < TRAIL; i++) {
        const f = k(TRAIL_FOLLOW - i * 0.009);
        trail[i * 2] += (leaderX - trail[i * 2]) * f;
        trail[i * 2 + 1] += (leaderY - trail[i * 2 + 1]) * f;
        leaderX = trail[i * 2];
        leaderY = trail[i * 2 + 1];
      }
      // main.js moves the CSS background with a scroll parallax; follow it so the two stay aligned
      const offsetY = (parseFloat(header.style.backgroundPositionY) || 0) * dpr;
      gl.uniform2f(u.resolution, canvas.width, canvas.height);
      gl.uniform2f(u.mouse, current.x, current.y);
      gl.uniform2fv(u.trail, trail);
      gl.uniform1f(u.strength, current.strength);
      gl.uniform1f(u.time, now * 0.001);
      gl.uniform1f(u.offsetY, offsetY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (target.strength > 0 || current.strength > 0.001) {
        canvas.dataset.drawn = ""; // fade the canvas in over the CSS background
        if (visible) request();
      } else {
        delete canvas.dataset.drawn; // at rest the plain CSS background (and its parallax) shows again
        last = 0;
      }
    }

    header.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      target.x = (e.clientX - rect.left) / rect.width;
      target.y = 1 - (e.clientY - rect.top) / rect.height;
      target.strength = 1;
      request();
    });
    header.addEventListener("pointerleave", () => { target.strength = 0; request(); });
    addEventListener("scroll", () => { if (current.strength > 0.001) request(); }, { passive: true });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) request(); }).observe(header);
    new ResizeObserver(() => {
      dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
      canvas.width = Math.max(1, Math.round(canvas.offsetWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.offsetHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      request();
    }).observe(canvas);
  }
})();