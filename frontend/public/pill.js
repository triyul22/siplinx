// Плавающая пилюля автодетекта встречи (Granola-style).
//
// Отдельное always-on-top окно Tauri (label "pill"). Логику решений держит
// главное окно (MeetingDetectedBanner): у него контекст записи, тумблер и т.д.
// Сюда прилетают только команды показа, отсюда уходят только намерения юзера.
//
// Контракт событий:
//   Главное окно → пилюля:  pill-show-detect {app}, pill-show-recording, pill-hide
//   Пилюля → главное окно:  pill-start-recording, pill-stop-recording, pill-dismiss
//
// Vanilla JS: окно грузит этот файл напрямую (public/pill.html), без React.
// Нужен withGlobalTauri:true — доступ к window.__TAURI__.

(function () {
  const T = window.__TAURI__;
  if (!T) {
    console.error("[pill] __TAURI__ недоступен (withGlobalTauri?)");
    return;
  }
  const { event, window: tauriWindow } = T;
  const appWindow = tauriWindow.getCurrentWindow();

  // --- локализация (тот же ключ, что у главного приложения: "siplinx.lang") ---
  const lang = (() => {
    try {
      const v = localStorage.getItem("siplinx.lang");
      return v === "en" ? "en" : "ru";
    } catch {
      return "ru";
    }
  })();
  const STR = {
    ru: {
      detectTitleApp: (app) => `Обнаружен звонок в ${app}`,
      detectTitleGeneric: "Обнаружена встреча",
      detectSub: "Записать встречу?",
      record: "Записать",
      starting: "Запуск...",
      stop: "Стоп",
      dragTip: "Перетащить",
    },
    en: {
      detectTitleApp: (app) => `${app} call detected`,
      detectTitleGeneric: "Meeting detected",
      detectSub: "Record this meeting?",
      record: "Record",
      starting: "Starting...",
      stop: "Stop",
      dragTip: "Drag",
    },
  }[lang];

  // --- элементы ---
  const pill = document.getElementById("pill");
  const detectTitle = document.getElementById("detect-title");
  const detectSub = document.getElementById("detect-sub");
  const recTime = document.getElementById("rec-time");
  const grip = document.getElementById("grip");
  const btnRecord = document.getElementById("btn-record");
  const btnRecordLabel = document.getElementById("btn-record-label");

  btnRecordLabel.textContent = STR.record;
  document.getElementById("btn-stop-label").textContent = STR.stop;
  detectSub.textContent = STR.detectSub;
  grip.title = STR.dragTip;

  // --- показ/скрытие окна + позиция «сверху справа» ---
  let positioned = false;
  async function placeTopRight() {
    if (positioned) return;
    try {
      const monitor = await tauriWindow.currentMonitor();
      const size = await appWindow.outerSize();
      if (monitor) {
        const scale = monitor.scaleFactor || 1;
        // physical → logical
        const mw = monitor.size.width / scale;
        const mx = monitor.position.x / scale;
        const my = monitor.position.y / scale;
        const pw = size.width / scale;
        const margin = 20;
        const x = Math.round(mx + mw - pw - margin);
        const y = Math.round(my + margin);
        await appWindow.setPosition(new tauriWindow.LogicalPosition(x, y));
        positioned = true;
      }
    } catch (e) {
      console.error("[pill] позиционирование не удалось:", e);
    }
  }

  async function showPill() {
    await placeTopRight();
    try {
      await appWindow.show();
      await appWindow.setAlwaysOnTop(true);
    } catch (e) {
      console.error("[pill] show failed:", e);
    }
  }
  async function hidePill() {
    stopTimer();
    try {
      await appWindow.hide();
    } catch (e) {
      console.error("[pill] hide failed:", e);
    }
  }

  // --- таймер записи (свой отсчёт от момента recording-started) ---
  let timerId = null;
  let startedAt = 0;
  function fmt(total) {
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  function startTimer() {
    stopTimer();
    startedAt = Date.now();
    recTime.textContent = "00:00";
    timerId = setInterval(() => {
      recTime.textContent = fmt(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }
  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function setState(s) {
    pill.setAttribute("data-state", s);
    pill.classList.add("show");
  }

  function setStartPending(pending) {
    btnRecord.disabled = pending;
    btnRecord.setAttribute("aria-busy", pending ? "true" : "false");
    btnRecordLabel.textContent = pending ? STR.starting : STR.record;
  }

  // --- входящие команды от главного окна ---
  event.listen("pill-show-detect", async (e) => {
    const app = e.payload && e.payload.app ? String(e.payload.app) : null;
    detectTitle.textContent = app ? STR.detectTitleApp(app) : STR.detectTitleGeneric;
    setStartPending(false);
    stopTimer();
    setState("detect");
    await showPill();
  });

  event.listen("pill-show-recording", async () => {
    setStartPending(false);
    setState("rec");
    startTimer();
    await showPill();
  });

  event.listen("pill-hide", async () => {
    setStartPending(false);
    pill.classList.remove("show");
    await hidePill();
  });

  // --- исходящие намерения юзера ---
  btnRecord.addEventListener("click", () => {
    if (btnRecord.disabled) return;
    setStartPending(true);
    event.emit("pill-start-recording").catch((e) => {
      console.error("[pill] start emit failed:", e);
      setStartPending(false);
    });
  });

  document.getElementById("btn-stop").addEventListener("click", () => {
    event.emit("pill-stop-recording");
  });

  document.getElementById("btn-dismiss").addEventListener("click", () => {
    event.emit("pill-dismiss");
    pill.classList.remove("show");
    hidePill();
  });

  // перетаскивание за ручку
  grip.addEventListener("mousedown", (ev) => {
    // только ЛКМ, и не мешаем кликам по кнопкам
    if (ev.button !== 0) return;
    appWindow.startDragging().catch((e) => console.error("[pill] drag:", e));
  });

  console.log("[pill] готова, lang =", lang);
})();
