const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
const OVERLAY_NAME = "roue_loto";

/* ===================== CSS UTILS ===================== */
function cssVar(name, fallback = "") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim().replace(/^['"]+|['"]+$/g, "") : fallback;
}
function cssNum(name, fallback) {
  const n = Number(cssVar(name, ""));
  return Number.isFinite(n) ? n : fallback;
}
function cssOnOff(name, fallbackOn = true) {
  const v = (cssVar(name, "") || "").toLowerCase();
  if (!v) return fallbackOn;
  return v === "on" || v === "true" || v === "1";
}
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/* ===================== BOOT / SECURITY ===================== */
const elSecurity = document.getElementById("security-screen");
const elApp = document.getElementById("app");
const elWinnerName = document.getElementById("winnerName");

function setBootTransparent(){
  elSecurity.style.display = "none";
  elApp.style.display = "none";
  document.documentElement.classList.remove(
    "mdi-ready","mdi-denied","mdi-confetti","mdi-show-winner","mdi-pointer-flip"
  );
}
function showDenied(){
  document.documentElement.classList.add("mdi-denied");
  elSecurity.style.display = "flex";
  elApp.style.display = "none";
  document.body.style.backgroundColor = "black";
}
function showReady(){
  document.documentElement.classList.remove("mdi-denied");
  document.documentElement.classList.add("mdi-ready");
  elSecurity.style.display = "none";
  elApp.style.display = "grid";
  document.body.style.backgroundColor = "transparent";
}
function hideWinner(){
  document.documentElement.classList.remove("mdi-show-winner");
  elWinnerName.textContent = "";
}

/* ===================== CONFIG ===================== */
let spinTrigger, collectStartTrigger, collectStopTrigger;
let spinCooldownMs, baselineMaxMessages;
let spinDirection, pointerSide;

function readConfig(){
  spinTrigger = cssVar("--spin-trigger","SPIN").trim();
  collectStartTrigger = cssVar("--collect-start-trigger","INSCRIVEZ UN PSEUDO").trim();
  collectStopTrigger = cssVar("--collect-stop-trigger","PRET?").trim();

  spinCooldownMs = clamp(cssNum("--spin-cooldown-ms",1800),500,12000);
  baselineMaxMessages = clamp(cssNum("--baseline-max-messages",6000),500,20000);

  spinDirection = cssVar("--spin-direction","cw").toLowerCase();
  spinDirection = (spinDirection === "ccw") ? "ccw" : "cw";

  pointerSide = cssVar("--pointer-side","right").toLowerCase();
  pointerSide = (pointerSide === "left") ? "left" : "right";
  document.documentElement.setAttribute("data-pointer-side", pointerSide);

  document.documentElement.classList.toggle(
    "mdi-pointer-flip",
    cssOnOff("--pointer-rotate-180", true)
  );
}

/* ===================== TEXT ===================== */
function normalizeText(t){
  return String(t||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
}
function normKey(t){ return normalizeText(t).toUpperCase(); }

/* ===================== BASELINE ===================== */
class LRUSet {
  constructor(max){ this.max=max; this.map=new Map(); }
  add(k){
    if(!k) return;
    if(this.map.has(k)) this.map.delete(k);
    this.map.set(k,true);
    while(this.map.size>this.max){
      this.map.delete(this.map.keys().next().value);
    }
  }
  snapshot(){ return new Set(this.map.keys()); }
  clear(){ this.map.clear(); }
  setMax(n){ this.max=n; }
}

const preStartIndex = new LRUSet(6000);
let baselineSet = new Set();

/* ===================== WHEEL ===================== */
const wheel = document.getElementById("wheel");
const ctx = wheel.getContext("2d");

let wheelAngle = 0;
let spinning = false;
let participants = [];
let phase = "IDLE";
let lastSpinAt = 0;

const palette = [
  "#2ecc71","#e74c3c","#3b82f6","#f1c40f",
  "#9b59b6","#1abc9c","#e67e22","#ec4899"
];

function resizeWheel(){
  const size = cssNum("--wheel-size",820);
  const dpr = Math.max(1,window.devicePixelRatio||1);
  wheel.style.width = size+"px";
  wheel.style.height = size+"px";
  wheel.width = size*dpr;
  wheel.height = size*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawWheel();
}

function drawWheel(){
  const size = cssNum("--wheel-size",820);
  const stroke = cssNum("--wheel-stroke",16);
  const textSize = cssNum("--wheel-text-size",30);
  const textWeight = cssNum("--wheel-text-weight",900);

  const cx=size/2, cy=size/2;
  const r=cx-stroke-6;

  ctx.clearRect(0,0,size,size);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(wheelAngle);

  if(!participants.length){
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fillStyle="rgba(10,15,30,0.65)";
    ctx.fill();
    ctx.lineWidth=stroke;
    ctx.strokeStyle="rgba(255,255,255,0.18)";
    ctx.stroke();
    ctx.restore();
    return;
  }

  const n=participants.length;
  const slice=(Math.PI*2)/n;

  for(let i=0;i<n;i++){
    const a0=i*slice, a1=a0+slice;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,r,a0,a1);
    ctx.fillStyle=palette[i%palette.length];
    ctx.fill();

    const mid=a0+slice/2;
    const label=participants[i].name;
    const safe=label.length>14?label.slice(0,13)+"…":label;
    const tx=r*0.28;

    ctx.save();
    ctx.rotate(mid);

    const flip = cssOnOff("--label-rotate-180",false);
    if(flip){
      ctx.rotate(Math.PI);
      ctx.textAlign="right";
      ctx.strokeText(safe,-tx,0);
      ctx.fillText(safe,-tx,0);
    } else {
      ctx.textAlign="left";
      ctx.strokeText(safe,tx,0);
      ctx.fillText(safe,tx,0);
    }

    ctx.font=`${textWeight} ${textSize}px Montserrat`;
    ctx.fillStyle="#fff";
    ctx.lineWidth=4;
    ctx.strokeStyle="rgba(0,0,0,0.35)";
    ctx.textBaseline="middle";
    ctx.restore();
  }

  ctx.restore();
}

/* ===================== SPIN ===================== */
function pointerTargetAngle(){
  return (pointerSide==="left")?Math.PI:0;
}

function spin(){
  if(spinning||phase!=="READY"||participants.length<2) return;
  if(Date.now()-lastSpinAt<spinCooldownMs) return;
  lastSpinAt=Date.now();

  spinning=true;
  const n=participants.length;
  const slice=(Math.PI*2)/n;
  const selected=Math.floor(Math.random()*n);
  const desired=pointerTargetAngle()-(selected*slice+slice/2);
  const extra=(6+Math.floor(Math.random()*4))*Math.PI*2;
  const dir=(spinDirection==="cw")?+1:-1;

  const start=wheelAngle;
  const target=desired+dir*extra;
  const startTs=performance.now();
  const dur=4200;

  function tick(ts){
    const t=Math.min(1,(ts-startTs)/dur);
    const e=1-Math.pow(1-t,3);
    wheelAngle=start+(target-start)*e;
    drawWheel();
    if(t<1) return requestAnimationFrame(tick);
    spinning=false;
    document.documentElement.classList.add("mdi-show-winner");
  }
  requestAnimationFrame(tick);
}

/* ===================== SOCKET ===================== */
let socket;
function initSocket(){
  socket=io(SERVER_URL,{transports:["websocket","polling"]});
  socket.on("connect",()=>{
    socket.emit("overlay:join",{
      room:cssVar("--room-id",""),
      key:cssVar("--room-key",""),
      overlay:OVERLAY_NAME
    });
  });
  socket.on("overlay:forbidden",showDenied);
  socket.on("overlay:state",p=>{
    if(p?.overlay!==OVERLAY_NAME) return;
    showReady();
    readConfig();
    participants=[];
    preStartIndex.clear();
    baselineSet.clear();
    phase="IDLE";
    drawWheel();
  });
  socket.on("raw_vote",d=>{
    const msg=normalizeText(d?.vote);
    if(!msg) return;

    if(phase==="IDLE") preStartIndex.add(normKey(msg));

    if(normKey(msg)===normKey(collectStartTrigger)){
      baselineSet=preStartIndex.snapshot();
      phase="COLLECTING";
      return;
    }
    if(normKey(msg)===normKey(collectStopTrigger)){
      phase="READY";
      return;
    }
    if(normKey(msg)===normKey(spinTrigger)){
      spin();
      return;
    }
    if(phase!=="COLLECTING") return;
    if(baselineSet.has(normKey(msg))) return;

    participants.push({name:msg});
    drawWheel();
  });
}

/* ===================== INIT ===================== */
function init(){
  setBootTransparent();
  readConfig();
  resizeWheel();
  initSocket();
  window.addEventListener("resize",resizeWheel);
}
init();
