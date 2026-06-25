/* ====================================================================
   MOTUS — logique du jeu
   ==================================================================== */
(function () {
  "use strict";

  const MAX_TRIES = 6;
  const DIFF_LABELS = {
    tres_facile: "Très facile",
    facile: "Facile",
    moyen: "Moyen",
    difficile: "Difficile",
    tres_difficile: "Très difficile",
  };

  // --- État ---
  const state = {
    length: 7,
    diff: "facile",
    answer: "",
    row: 0,
    col: 1,        // colonne 0 = lettre offerte, verrouillée
    guess: [],     // tableau de lettres de la tentative en cours
    over: false,
  };

  // --- Raccourcis DOM ---
  const $ = (id) => document.getElementById(id);
  const screenHome = $("screen-home");
  const screenGame = $("screen-game");
  const board = $("board");
  const keyboard = $("keyboard");
  const message = $("message");

  /* ---------------- Accueil : sélecteurs ---------------- */
  $("length-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    document.querySelectorAll("#length-picker .pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    state.length = parseInt(btn.dataset.length, 10);
  });

  $("difficulty-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".diff");
    if (!btn) return;
    document.querySelectorAll("#difficulty-picker .diff").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    state.diff = btn.dataset.diff;
  });

  $("btn-play").addEventListener("click", startGame);
  $("btn-back").addEventListener("click", goHome);
  $("btn-new").addEventListener("click", () => startGame());
  $("btn-menu").addEventListener("click", () => { closeModal("modal-end"); goHome(); });
  $("btn-replay").addEventListener("click", () => { closeModal("modal-end"); startGame(); });

  /* ---------------- Modales ---------------- */
  $("btn-help").addEventListener("click", () => openModal("modal-help"));
  document.querySelectorAll("[data-close-help]").forEach((el) =>
    el.addEventListener("click", () => closeModal("modal-help"))
  );
  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }

  /* ---------------- Démarrage d'une partie ---------------- */
  function pickWord() {
    const list = (WORDS[state.length] && WORDS[state.length][state.diff]) || [];
    if (!list.length) return "MAISON".slice(0, state.length);
    return list[Math.floor(Math.random() * list.length)];
  }

  function startGame() {
    state.answer = pickWord();
    state.row = 0;
    state.over = false;
    resetGuess();
    $("tag-length").textContent = state.length + " lettres";
    $("tag-diff").textContent = DIFF_LABELS[state.diff];
    buildBoard();
    buildKeyboard();
    message.textContent = "";
    screenHome.classList.remove("active");
    screenGame.classList.add("active");
    renderGuess();
  }

  function goHome() {
    screenGame.classList.remove("active");
    screenHome.classList.add("active");
  }

  function resetGuess() {
    state.col = 1;
    state.guess = new Array(state.length).fill("");
    state.guess[0] = state.answer[0]; // lettre offerte
  }

  /* ---------------- Construction de la grille ---------------- */
  function buildBoard() {
    board.innerHTML = "";
    board.style.maxWidth = Math.min(560, state.length * 76) + "px";
    for (let r = 0; r < MAX_TRIES; r++) {
      const row = document.createElement("div");
      row.className = "row";
      row.style.gridTemplateColumns = `repeat(${state.length}, 1fr)`;
      row.dataset.row = r;
      for (let c = 0; c < state.length; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
  }

  /* ---------------- Clavier virtuel ---------------- */
  const KB_ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
  function buildKeyboard() {
    keyboard.innerHTML = "";
    KB_ROWS.forEach((letters, i) => {
      const row = document.createElement("div");
      row.className = "kb-row";
      if (i === 2) row.appendChild(makeKey("ENTRÉE", "Enter", true));
      letters.split("").forEach((l) => row.appendChild(makeKey(l, l, false)));
      if (i === 2) row.appendChild(makeKey("⌫", "Backspace", true));
      keyboard.appendChild(row);
    });
  }
  function makeKey(label, value, wide) {
    const k = document.createElement("button");
    k.className = "key" + (wide ? " wide" : "");
    k.textContent = label;
    k.dataset.key = value;
    k.addEventListener("click", () => handleKey(value));
    return k;
  }

  /* ---------------- Saisie ---------------- */
  function handleKey(key) {
    if (state.over) return;
    if (key === "Enter") return submitGuess();
    if (key === "Backspace") return deleteLetter();
    if (/^[A-Za-z]$/.test(key)) return addLetter(key.toUpperCase());
  }

  function addLetter(letter) {
    if (state.col >= state.length) return;
    state.guess[state.col] = letter;
    state.col++;
    renderGuess();
  }

  function deleteLetter() {
    if (state.col <= 1) return; // ne pas effacer la lettre offerte
    state.col--;
    state.guess[state.col] = "";
    renderGuess();
  }

  function renderGuess() {
    const row = board.querySelector(`.row[data-row="${state.row}"]`);
    if (!row) return;
    const cells = row.querySelectorAll(".cell");
    cells.forEach((cell, c) => {
      cell.textContent = state.guess[c] || "";
      cell.classList.toggle("filled", !!state.guess[c]);
      cell.classList.toggle("cursor", c === state.col && !state.over);
    });
  }

  /* ---------------- Validation d'une tentative ---------------- */
  function submitGuess() {
    if (state.col < state.length) {
      flash("Complétez le mot");
      return shakeRow();
    }
    const word = state.guess.join("");
    const dicoSet = typeof DICO !== "undefined" ? DICO[state.length] : null;
    if (dicoSet && !dicoSet.has(word) && word !== state.answer) {
      flash("Mot inconnu du dictionnaire");
      return shakeRow();
    }
    revealRow(word);
  }

  function evaluate(word, answer) {
    const res = new Array(word.length).fill("absent");
    const counts = {};
    for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
    // 1er passage : bien placées
    for (let i = 0; i < word.length; i++) {
      if (word[i] === answer[i]) { res[i] = "ok"; counts[word[i]]--; }
    }
    // 2e passage : présentes mal placées
    for (let i = 0; i < word.length; i++) {
      if (res[i] === "ok") continue;
      if (counts[word[i]] > 0) { res[i] = "present"; counts[word[i]]--; }
    }
    return res;
  }

  function revealRow(word) {
    const verdict = evaluate(word, state.answer);
    const row = board.querySelector(`.row[data-row="${state.row}"]`);
    const cells = row.querySelectorAll(".cell");
    cells.forEach((c) => c.classList.remove("cursor"));

    verdict.forEach((v, i) => {
      setTimeout(() => {
        const cell = cells[i];
        cell.classList.add("reveal", v);
        updateKey(word[i], v);
      }, i * 220);
    });

    const total = verdict.length * 220 + 260;
    setTimeout(() => {
      if (word === state.answer) return endGame(true);
      state.row++;
      if (state.row >= MAX_TRIES) return endGame(false);
      resetGuess();
      renderGuess();
    }, total);
  }

  // Met à jour la couleur d'une touche (sans rétrograder ok > present > absent)
  const RANK = { absent: 0, present: 1, ok: 2 };
  function updateKey(letter, verdict) {
    const key = keyboard.querySelector(`.key[data-key="${letter}"]`);
    if (!key) return;
    const cur = key.classList.contains("ok") ? "ok"
      : key.classList.contains("present") ? "present"
      : key.classList.contains("absent") ? "absent" : null;
    if (cur && RANK[cur] >= RANK[verdict]) return;
    key.classList.remove("ok", "present", "absent");
    key.classList.add(verdict);
  }

  /* ---------------- Fin de partie ---------------- */
  function endGame(won) {
    state.over = true;
    const tries = state.row + 1;
    $("end-emoji").textContent = won ? "🎉" : "😶";
    $("end-title").textContent = won ? "Bravo !" : "Perdu…";
    $("end-text").textContent = won
      ? `Trouvé en ${tries} essai${tries > 1 ? "s" : ""}.`
      : "Vous n'avez plus d'essais.";
    $("end-word").textContent = state.answer;
    setTimeout(() => openModal("modal-end"), 350);
  }

  /* ---------------- Utilitaires UI ---------------- */
  let flashTimer;
  function flash(text) {
    message.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (message.textContent = ""), 1600);
  }
  function shakeRow() {
    const row = board.querySelector(`.row[data-row="${state.row}"]`);
    if (!row) return;
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 420);
  }

  /* ---------------- Clavier physique ---------------- */
  document.addEventListener("keydown", (e) => {
    if (!screenGame.classList.contains("active")) return;
    if (e.key === "Enter" || e.key === "Backspace" || /^[A-Za-z]$/.test(e.key)) {
      e.preventDefault();
      handleKey(e.key);
    }
  });

})();
