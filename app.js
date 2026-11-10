(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pages = ["home", "library", "media"];
  const games = {
    orbit: {name:"Orbit Runner", kind:"demo"},
    neon: {name:"Neon Drift", kind:"demo"},
    pulse: {name:"Pulse Sector", kind:"soon"},
    void: {name:"Void Garden", kind:"soon"}
  };
  const gameDialog = $("#game-dialog");
  const searchDialog = $("#search-dialog");
  const profileDialog = $("#profile-dialog");
  const player = $("#player");
  const stage = $("#game-stage");
  const status = $("#game-status");
  const toast = $("#toast");
  let position = {x:50, y:50};
  let activeGame = "orbit";
  let toastTimer = null;
  const pressed = new Set();
  const movementKeys = new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"]);

  $("#today-label").textContent = `NEXO WEB · ${new Date().getFullYear()}`;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function navigate(page) {
    if (!pages.includes(page)) return;
    $$(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
    $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
    window.scrollTo({top:0, behavior:"smooth"});
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) navigate(pageButton.dataset.page);
    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "open-library") navigate("library");
    const close = event.target.closest("[data-close]");
    if (close) $("#" + close.dataset.close)?.close();
  });

  function openGame(id) {
    const game = games[id];
    if (!game) return;
    if (game.kind !== "demo") {
      notify("Este título ainda está em desenvolvimento.");
      return;
    }
    activeGame = id;
    $("#game-name").textContent = game.name;
    position = {x:50,y:50};
    renderPlayer();
    status.textContent = "PRONTO";
    gameDialog.showModal();
    stage.focus();
  }
  $$("[data-game]").forEach(button => button.addEventListener("click", () => openGame(button.dataset.game)));
  $("#open-controller").addEventListener("click", () => openGame("orbit"));
  $("#reset-game").addEventListener("click", () => {
    position = {x:50,y:50}; renderPlayer(); status.textContent = "REINICIADO"; notify("Demonstração reiniciada.");
  });

  function renderPlayer() {
    player.style.left = `${position.x}%`;
    player.style.top = `${position.y}%`;
  }
  function move(direction) {
    const step = 4;
    if (direction === "up") position.y -= step;
    if (direction === "down") position.y += step;
    if (direction === "left") position.x -= step;
    if (direction === "right") position.x += step;
    position.x = Math.max(5, Math.min(95, position.x));
    position.y = Math.max(12, Math.min(88, position.y));
    renderPlayer();
    status.textContent = "EM MOVIMENTO";
  }
  function controlAction(control) {
    if (["up","down","left","right"].includes(control)) move(control);
    else if (control === "start") { status.textContent = "PAUSADO"; notify("START: demonstração pausada."); }
    else if (control === "select") notify("SELECT: nenhuma ação atribuída nesta demo.");
    else notify(`${control.toUpperCase()}: botão reconhecido.`);
  }

  // Pointer controls support touch, mouse, and stylus; repeated movement while held.
  let holdTimer = null;
  let heldControl = null;
  function stopHold() {
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = null; heldControl = null;
  }
  $$("[data-control]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      const control = button.dataset.control;
      if (["up","down","left","right"].includes(control)) {
        stopHold(); heldControl = control; move(control);
        holdTimer = setInterval(() => { if (heldControl) move(heldControl); }, 145);
      } else controlAction(control);
    });
    ["pointerup","pointercancel","pointerleave","lostpointercapture"].forEach(type => button.addEventListener(type, stopHold));
  });
  window.addEventListener("blur", stopHold);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopHold(); });

  document.addEventListener("keydown", event => {
    if (!gameDialog.open || event.repeat) return;
    if (movementKeys.has(event.key)) {
      event.preventDefault();
      const key = event.key.toLowerCase();
      const map = {arrowup:"up",w:"up",arrowdown:"down",s:"down",arrowleft:"left",a:"left",arrowright:"right",d:"right"};
      move(map[key]);
    } else if (event.key === "Enter") controlAction("start");
  });

  // Search filters the local game catalog; it does not access the internet.
  $("#search-toggle").addEventListener("click", () => {
    searchDialog.showModal(); $("#search-input").focus(); renderSearch("");
  });
  function renderSearch(query) {
    const results = Object.entries(games).filter(([,game]) => game.name.toLowerCase().includes(query.toLowerCase()));
    $("#search-results").replaceChildren();
    if (!results.length) {
      const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "Nenhum jogo encontrado."; $("#search-results").append(empty); return;
    }
    results.forEach(([id,game]) => {
      const button = document.createElement("button"); button.className = "search-result";
      button.textContent = `${game.name} · ${game.kind === "demo" ? "Demonstração" : "Em breve"}`;
      button.addEventListener("click", () => { searchDialog.close(); openGame(id); });
      $("#search-results").append(button);
    });
  }
  $("#search-input").addEventListener("input", event => renderSearch(event.target.value));

  $("#profile-button").addEventListener("click", () => profileDialog.showModal());

  $$(".filter").forEach(button => button.addEventListener("click", () => {
    $$(".filter").forEach(item => item.classList.toggle("active", item === button));
    const filter = button.dataset.filter;
    $$(".library-card").forEach(card => {
      card.hidden = filter !== "all" && card.dataset.kind !== filter;
    });
  }));

  // Optional physical gamepad support: standard Gamepad API, when browser/device exposes it.
  let gamepadFrame = null;
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad && gameDialog.open) {
      const deadzone = 0.45;
      if (pad.axes[1] < -deadzone) move("up");
      else if (pad.axes[1] > deadzone) move("down");
      if (pad.axes[0] < -deadzone) move("left");
      else if (pad.axes[0] > deadzone) move("right");
    }
    gamepadFrame = requestAnimationFrame(pollGamepad);
  }
  if ("getGamepads" in navigator) {
    window.addEventListener("gamepadconnected", () => notify("Controle físico conectado."));
    window.addEventListener("gamepaddisconnected", () => notify("Controle físico desconectado."));
    gamepadFrame = requestAnimationFrame(pollGamepad);
  }
  window.addEventListener("pagehide", () => {
    stopHold();
    if (gamepadFrame) cancelAnimationFrame(gamepadFrame);
  });
})();