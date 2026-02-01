/* globals io */
(() => {
  const SERVER_URL = "https://magic-digital-impact-live.onrender.com";
  const OVERLAY = "commentaires"; // IMPORTANT: doit rester EXACTEMENT "commentaires"

  const $ = (id) => document.getElementById(id);

  const elText = $("text");
  const elMeta = $("meta");

  const dbgRoom = $("dbgRoom");
  const dbgSock = $("dbgSock");
  const dbgJoin = $("dbgJoin");
  const dbgLast = $("dbgLast");

  let socket = null;

  function setBodyState(state){
    // state: "idle" | "show"
    document.body.classList.remove("is-idle","is-show");
    document.body.classList.add(state === "show" ? "is-show" : "is-idle");
  }

  function setDebug({ room, sock, join, last }){
    if(room != null) dbgRoom.textContent = room || "—";
    if(sock != null) dbgSock.textContent = sock || "—";
    if(join != null) dbgJoin.textContent = join || "—";
    if(last != null) dbgLast.textContent = last || "—";
  }

  function clean(t){
    return String(t ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseAuth(){
    // Priorité à l'URL (?room=...&key=...)
    const u = new URL(location.href);
    const room = clean(u.searchParams.get("room"));
    const key  = clean(u.searchParams.get("key"));
    return { room, key };
  }

  function showText({ text, user }){
    const t = clean(text);
    if(!t){
      hideText();
      return;
    }
    elText.textContent = t;
    elMeta.textContent = user ? `— ${clean(user)}` : "";
    setBodyState("show");
  }

  function hideText(){
    setBodyState("idle");
  }

  // Supporte plusieurs formats d'events serveur (robuste)
  function handleStatePayload(payload){
    // payload attendu (souple) :
    // { state:"show"/"hide", data:{text, user} }
    // OU { state:"show", text:"...", user:"..." }
    // OU { action:"show"/"hide", text:"..." } etc.

    const p = payload || {};
    const state = clean(p.state || p.action).toLowerCase();

    if(state === "hide" || state === "idle" || state === "off"){
      setDebug({ last: "state=hide" });
      hideText();
      return;
    }

    if(state === "show" || state === "on"){
      const d = p.data || p.payload || {};
      const text = p.text ?? d.text;
      const user = p.user ?? d.user;
      setDebug({ last: "state=show" });
      showText({ text, user });
      return;
    }

    // parfois le serveur envoie directement {text:"..."}
    const directText = p.text ?? (p.data && p.data.text);
    if(clean(directText)){
      setDebug({ last: "direct text" });
      showText({ text: directText, user: p.user ?? (p.data && p.data.user) });
    }
  }

  function connect(){
    const { room, key } = parseAuth();

    document.body.classList.add("is-ready");
    setDebug({ room, sock: "connecting...", join: "—", last: "—" });

    if(!room || !key){
      setDebug({ sock: "missing room/key", join: "NO" });
      // en overlay OBS tu auras l'URL avec ?room=...&key=...
      return;
    }

    socket = io(SERVER_URL, { transports: ["websocket","polling"] });

    socket.on("connect", () => {
      setDebug({ sock: "connected", join: "sent" });
      socket.emit("overlay:join", { room, key, overlay: OVERLAY });
    });

    socket.on("overlay:forbidden", () => {
      setDebug({ sock: "FORBIDDEN", join: "refused" });
      hideText();
    });

    socket.on("disconnect", () => {
      setDebug({ sock: "disconnected" });
      hideText();
    });

    // --- ÉVÉNEMENTS POSSIBLES CÔTÉ SERVEUR ---
    // 1) Si le serveur broadcast raw_vote dans la room (pour debug)
    socket.on("raw_vote", (data) => {
      const t = clean(data?.vote ?? data?.text);
      if(t) setDebug({ last: `raw_vote: ${t.slice(0, 40)}${t.length>40?"…":""}` });
    });

    // 2) Si le serveur broadcast un "set_state" générique
    socket.on("control:set_state", handleStatePayload);

    // 3) variantes fréquentes
    socket.on("overlay:set_state", handleStatePayload);
    socket.on("overlay:state", handleStatePayload);
    socket.on("commentaires:set_state", handleStatePayload);
    socket.on("commentaires:state", handleStatePayload);

    // 4) ancien event spécifique
    socket.on("control:commentaires", handleStatePayload);
  }

  // état initial
  setBodyState("idle");
  document.body.classList.add("is-ready");

  connect();
})();
