/**
 * MDI EMOJI TORNADO - V6 SaaS
 * Entitlement Supabase : emojis_tornado
 */

const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_TYPE = "emojis_tornado";

let state = {
    authorized: false,
    particles: [],
    emojiBank: {},
    totalVotes: 0,
    config: {},
    canvas: null,
    ctx: null
};

// Utilitaire de lecture CSS
const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/['"]/g, "") || fallback;

// Gestion des erreurs d'accès
function showDenied() {
    document.getElementById("loading-shield").classList.add("hidden");
    document.getElementById("access-denied").classList.remove("hidden");
}

const socket = io(SERVER_URL, { transports: ["websocket"] });

async function init() {
    await new Promise(r => setTimeout(r, 800)); // Attente OBS

    const room = cssVar("--room-id", "");
    const key = cssVar("--room-key", "");

    if (!room || !key) { showDenied(); return; }

    // Connexion SaaS
    socket.emit('overlay:join', { room, key, overlay: OVERLAY_TYPE });

    socket.on('overlay:forbidden', showDenied);

    socket.on('overlay:state', (payload) => {
        if (payload?.overlay === OVERLAY_TYPE) {
            state.authorized = true;
            document.getElementById("loading-shield").classList.add("hidden");
            document.getElementById("app-viewport").classList.remove("hidden");
            setTimeout(() => document.getElementById("app-viewport").classList.add("visible"), 50);
            
            startEngine();
        }
    });
}

function startEngine() {
    state.canvas = document.getElementById("tornado-canvas");
    state.ctx = state.canvas.getContext("2d");
    
    window.addEventListener('resize', resize);
    resize();

    // Listener universel pour Watchtower
    socket.on("mise_a_jour_overlay", (data) => {
        if (!state.authorized) return;
        let vote = typeof data === "object" ? data.vote : data;
        if (!vote) return;

        if (vote.trim().toUpperCase() === "RESET") {
            state.emojiBank = {}; state.totalVotes = 0; state.particles = [];
            return;
        }

        const matches = vote.match(/\p{Extended_Pictographic}/gu);
        if (matches) {
            matches.forEach(e => {
                state.emojiBank[e] = (state.emojiBank[e] || 0) + 1;
                state.totalVotes++;
            });
        }
    });

    setInterval(refreshConfig, 1000);
    requestAnimationFrame(renderLoop);
}

function refreshConfig() {
    const style = getComputedStyle(document.documentElement);
    state.config = {
        density: parseFloat(style.getPropertyValue('--particle-density')) || 0.1,
        max: parseInt(style.getPropertyValue('--particle-max')) || 60,
        opacity: parseFloat(style.getPropertyValue('--particle-opacity')) || 0.8,
        spread: parseFloat(style.getPropertyValue('--particle-spread')) || 0.5,
        sMin: parseInt(style.getPropertyValue('--particle-size-min')) || 22,
        sMax: parseInt(style.getPropertyValue('--particle-size-max')) || 45,
        speed: parseFloat(style.getPropertyValue('--velocity-base')) || 2.0
    };
}

function resize() {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        const keys = Object.keys(state.emojiBank);
        this.char = keys[Math.floor(Math.random() * keys.length)];
        this.reset();
    }
    reset() {
        this.y = state.canvas.height + 50;
        this.angle = Math.random() * Math.PI * 2;
        this.radius = Math.random() * (state.canvas.width * 0.5 * state.config.spread);
        this.sy = state.config.speed + Math.random() * 2;
        this.sa = 0.02 + Math.random() * 0.04;
        this.size = state.config.sMin + Math.random() * (state.config.sMax - state.config.sMin);
        this.alpha = 0;
    }
    update() {
        this.y -= this.sy;
        this.angle += this.sa;
        this.x = (state.canvas.width / 2) + Math.cos(this.angle) * this.radius;
        if (this.y < 150) this.alpha -= 0.02;
        else if (this.alpha < state.config.opacity) this.alpha += 0.05;
        if (this.y < -60 || this.alpha <= 0) this.reset();
    }
    draw() {
        state.ctx.save();
        state.ctx.globalAlpha = Math.max(0, this.alpha);
        state.ctx.font = `${this.size}px serif`;
        state.ctx.textAlign = "center";
        state.ctx.fillText(this.char, this.x, this.y);
        state.ctx.restore();
    }
}

function renderLoop() {
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    if (state.totalVotes > 0) {
        if (state.particles.length < state.config.max && Math.random() < state.config.density) {
            state.particles.push(new Particle());
        }
        state.particles.forEach(p => { p.update(); p.draw(); });
    }
    requestAnimationFrame(renderLoop);
}

init();