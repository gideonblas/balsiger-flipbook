(function () {
  const PAGE_COUNT = 246;
  const bookEl = document.getElementById("book");
  const loadingEl = document.getElementById("loading");
  const indicatorEl = document.getElementById("page-indicator");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  const stageEl = document.getElementById("stage");
  const zoomPanEl = document.getElementById("zoom-pan");
  const bookWrapperEl = document.getElementById("book-wrapper");

  const jumpToggle = document.getElementById("jump-toggle");
  const jumpPanel = document.getElementById("jump-panel");
  const jumpSlider = document.getElementById("jump-slider");
  const jumpInput = document.getElementById("jump-input");
  const jumpGo = document.getElementById("jump-go");

  const searchToggle = document.getElementById("search-toggle");
  const searchPanel = document.getElementById("search-panel");
  const searchInput = document.getElementById("search-input");
  const searchStatus = document.getElementById("search-status");
  const searchResults = document.getElementById("search-results");

  const PAGE_W = 1049;
  const PAGE_H = 1489;

  // Build the page DOM nodes (first & last are hard covers)
  for (let i = 0; i < PAGE_COUNT; i++) {
    const div = document.createElement("div");
    div.className = "page";
    if (i === 0 || i === PAGE_COUNT - 1) {
      div.setAttribute("data-density", "hard");
    }
    const img = document.createElement("img");
    const num = String(i).padStart(3, "0");
    img.src = `pages/p${num}.jpg`;
    img.alt = `עמוד ${i + 1}`;
    div.appendChild(img);
    bookEl.appendChild(div);
  }

  const pageFlip = new St.PageFlip(bookEl, {
    width: PAGE_W,
    height: PAGE_H,
    size: "stretch",
    minWidth: 280,
    maxWidth: 1400,
    minHeight: 397,
    maxHeight: 1986,
    showCover: true,
    flippingTime: 700,
    maxShadowOpacity: 0.5,
    usePortrait: true,
    mobileScrollSupport: false,
    // We fully own touch/mouse gestures ourselves (RTL-aware swipe,
    // pinch-zoom, pan). The library's built-in handlers attach to `window`
    // and would otherwise intercept every touch move in parallel with our
    // own logic, causing conflicts (e.g. the book glitching out during pinch).
    useMouseEvents: false,
  });

  let loaded = false;

  pageFlip.on("init", () => {
    loadingEl.style.display = "none";
    loaded = true;
    updateIndicator();
  });

  pageFlip.loadFromHTML(document.querySelectorAll(".page"));

  function updateIndicator() {
    const current = pageFlip.getCurrentPageIndex() + 1;
    indicatorEl.textContent = `${current} / ${PAGE_COUNT}`;
    jumpSlider.value = String(current);
    jumpInput.value = String(current);
  }

  pageFlip.on("flip", updateIndicator);

  function goToPage(zeroBasedIndex) {
    const clamped = Math.min(PAGE_COUNT - 1, Math.max(0, zeroBasedIndex));
    pageFlip.turnToPage(clamped);
    updateIndicator();
  }

  // "next" = advance forward through the book; wrapper mirroring already
  // makes the on-screen motion flow correctly right-to-left for Hebrew.
  nextBtn.addEventListener("click", () => pageFlip.flipNext());
  prevBtn.addEventListener("click", () => pageFlip.flipPrev());

  window.addEventListener("keydown", (e) => {
    if (!loaded) return;
    if (e.key === "ArrowLeft") pageFlip.flipNext();
    if (e.key === "ArrowRight") pageFlip.flipPrev();
  });

  // Safety timeout in case the init event doesn't fire for any reason
  setTimeout(() => {
    if (!loaded) loadingEl.style.display = "none";
  }, 8000);

  /* ---------------------------------------------------------------
   * Slide-up panels: quick jump + search
   * ------------------------------------------------------------- */

  function closePanel(panel) {
    panel.classList.add("hidden");
  }

  function togglePanel(panel, otherPanel) {
    const willOpen = panel.classList.contains("hidden");
    closePanel(otherPanel);
    panel.classList.toggle("hidden", !willOpen);
  }

  jumpToggle.addEventListener("click", () => togglePanel(jumpPanel, searchPanel));
  searchToggle.addEventListener("click", () => {
    togglePanel(searchPanel, jumpPanel);
    if (!searchPanel.classList.contains("hidden")) searchInput.focus();
  });

  document.querySelectorAll(".panel-close").forEach((btn) => {
    btn.addEventListener("click", () => closePanel(document.getElementById(btn.dataset.close)));
  });

  // Quick jump: slider + numeric input
  jumpSlider.addEventListener("input", () => {
    goToPage(parseInt(jumpSlider.value, 10) - 1);
  });

  function jumpFromInput() {
    const val = parseInt(jumpInput.value, 10);
    if (!isNaN(val)) goToPage(val - 1);
  }
  jumpGo.addEventListener("click", jumpFromInput);
  jumpInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpFromInput();
  });

  /* ---------------------------------------------------------------
   * Full-text search
   * ------------------------------------------------------------- */

  let pageTexts = [];
  fetch("search-index.json")
    .then((r) => r.json())
    .then((data) => {
      pageTexts = data;
    })
    .catch(() => {
      searchStatus.textContent = "החיפוש אינו זמין כרגע.";
    });

  function buildResultEl(pageIdx, before, match, after) {
    const el = document.createElement("div");
    el.className = "search-result";
    const pageSpan = document.createElement("span");
    pageSpan.className = "result-page";
    pageSpan.textContent = `עמ' ${pageIdx + 1}`;
    el.appendChild(pageSpan);
    el.appendChild(document.createTextNode((before ? "…" : "") + before));
    const mark = document.createElement("mark");
    mark.textContent = match;
    el.appendChild(mark);
    el.appendChild(document.createTextNode(after + (after ? "…" : "")));
    el.addEventListener("click", () => {
      goToPage(pageIdx);
      closePanel(searchPanel);
    });
    return el;
  }

  function runSearch(rawQuery) {
    searchResults.innerHTML = "";
    const query = rawQuery.trim();
    if (!query) {
      searchStatus.textContent = "";
      return;
    }
    if (!pageTexts.length) {
      searchStatus.textContent = "טוען אינדקס חיפוש...";
      return;
    }
    const lowerQuery = query.toLowerCase();
    const matches = [];
    for (let i = 0; i < pageTexts.length; i++) {
      const text = pageTexts[i];
      if (!text) continue;
      const idx = text.toLowerCase().indexOf(lowerQuery);
      if (idx !== -1) {
        const start = Math.max(0, idx - 45);
        const end = Math.min(text.length, idx + query.length + 45);
        matches.push({
          page: i,
          before: text.slice(start, idx).replace(/\s+/g, " "),
          match: text.slice(idx, idx + query.length),
          after: text.slice(idx + query.length, end).replace(/\s+/g, " "),
        });
      }
      if (matches.length >= 60) break;
    }
    searchStatus.textContent = matches.length
      ? `${matches.length} תוצאות`
      : "לא נמצאו תוצאות";
    matches.forEach((m) => {
      searchResults.appendChild(buildResultEl(m.page, m.before, m.match, m.after));
    });
  }

  searchInput.addEventListener("input", () => runSearch(searchInput.value));

  /* ---------------------------------------------------------------
   * Pinch-to-zoom + pan (touch, ctrl+wheel, double-click/tap)
   * ------------------------------------------------------------- */

  const MIN_SCALE = 1;
  const MAX_SCALE = 3;
  let scale = 1;
  let panX = 0;
  let panY = 0;

  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  function clampPan() {
    const rect = stageEl.getBoundingClientRect();
    const baseW = bookWrapperEl.offsetWidth || rect.width;
    const baseH = bookWrapperEl.offsetHeight || rect.height;
    const scaledW = baseW * scale;
    const scaledH = baseH * scale;
    const slack = 0.9;
    const maxPanX = scaledW * slack;
    const minPanX = rect.width - scaledW * slack;
    const maxPanY = scaledH * slack;
    const minPanY = rect.height - scaledH * slack;
    panX = Math.min(maxPanX, Math.max(minPanX, panX));
    panY = Math.min(maxPanY, Math.max(minPanY, panY));
  }

  function applyZoom() {
    zoomPanEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    bookWrapperEl.classList.toggle("zoomed", scale > 1.02);
  }

  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyZoom();
  }

  function zoomAtPoint(clientX, clientY, newScaleRaw) {
    const rect = stageEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const newScale = clampScale(newScaleRaw);
    const contentX = (localX - panX) / scale;
    const contentY = (localY - panY) / scale;
    scale = newScale;
    if (scale <= MIN_SCALE + 0.001) {
      panX = 0;
      panY = 0;
    } else {
      panX = localX - contentX * newScale;
      panY = localY - contentY * newScale;
      clampPan();
    }
    applyZoom();
  }

  function dist(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }
  function mid(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }

  let pinch = null;
  let singleDrag = null;
  let tapInfo = null; // tracks a potential tap for double-tap-to-zoom
  let lastTapTime = 0;

  stageEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        pinch = {
          startDist: dist(t1, t2),
          startScale: scale,
          startMid: mid(t1, t2),
          startPan: { x: panX, y: panY },
        };
        singleDrag = null;
        tapInfo = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        tapInfo = { x: t.clientX, y: t.clientY, time: Date.now() };
        if (scale > 1.02) {
          singleDrag = { startX: t.clientX, startY: t.clientY, startPan: { x: panX, y: panY } };
        }
      }
    },
    { passive: false }
  );

  stageEl.addEventListener(
    "touchmove",
    (e) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const newDist = dist(t1, t2);
        const newMid = mid(t1, t2);
        const newScale = clampScale(pinch.startScale * (newDist / pinch.startDist));
        const rect = stageEl.getBoundingClientRect();
        const localX0 = pinch.startMid.x - rect.left;
        const localY0 = pinch.startMid.y - rect.top;
        const contentX = (localX0 - pinch.startPan.x) / pinch.startScale;
        const contentY = (localY0 - pinch.startPan.y) / pinch.startScale;
        const localX1 = newMid.x - rect.left;
        const localY1 = newMid.y - rect.top;
        scale = newScale;
        if (scale <= MIN_SCALE + 0.001) {
          panX = 0;
          panY = 0;
        } else {
          panX = localX1 - contentX * newScale;
          panY = localY1 - contentY * newScale;
          clampPan();
        }
        applyZoom();
      } else if (singleDrag && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        panX = singleDrag.startPan.x + (t.clientX - singleDrag.startX);
        panY = singleDrag.startPan.y + (t.clientY - singleDrag.startY);
        clampPan();
        applyZoom();
        tapInfo = null;
      }
    },
    { passive: false }
  );

  // Thresholds for interpreting a finished single-finger gesture as a swipe
  // (page turn) rather than a tap.
  const SWIPE_MIN_DIST = 40;
  const SWIPE_MAX_TIME = 600;

  stageEl.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) pinch = null;
    if (e.touches.length === 0) {
      const wasPanning = !!singleDrag;
      singleDrag = null;
      if (tapInfo) {
        const t = e.changedTouches[0];
        const dx = t.clientX - tapInfo.x;
        const dy = t.clientY - tapInfo.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const dt = Date.now() - tapInfo.time;
        const isZoomed = scale > 1.02;

        if (!wasPanning && !isZoomed && dt < SWIPE_MAX_TIME && absDx > SWIPE_MIN_DIST && absDx > absDy) {
          // Horizontal swipe = page turn (inverted from the previous mapping
          // per user feedback on a real device).
          if (dx < 0) pageFlip.flipPrev();
          else pageFlip.flipNext();
          lastTapTime = 0;
        } else if (!wasPanning) {
          const now = Date.now();
          if (dt < 300 && now - lastTapTime < 300) {
            if (isZoomed) {
              resetZoom();
            } else {
              zoomAtPoint(tapInfo.x, tapInfo.y, 2.2);
            }
            lastTapTime = 0;
          } else {
            lastTapTime = now;
          }
        }
      }
      tapInfo = null;
    }
  });
  stageEl.addEventListener("touchcancel", () => {
    pinch = null;
    singleDrag = null;
    tapInfo = null;
  });

  // Desktop: ctrl + wheel (trackpad pinch / ctrl-scroll) to zoom
  stageEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAtPoint(e.clientX, e.clientY, scale * factor);
    },
    { passive: false }
  );

  // Desktop: double-click to zoom in/out, and mouse-drag to pan while zoomed
  stageEl.addEventListener("dblclick", (e) => {
    if (scale > 1.02) {
      resetZoom();
    } else {
      zoomAtPoint(e.clientX, e.clientY, 2.2);
    }
  });

  let mouseDrag = null;
  stageEl.addEventListener("mousedown", (e) => {
    if (scale <= 1.02) return;
    mouseDrag = { startX: e.clientX, startY: e.clientY, startPan: { x: panX, y: panY } };
  });
  window.addEventListener("mousemove", (e) => {
    if (!mouseDrag) return;
    panX = mouseDrag.startPan.x + (e.clientX - mouseDrag.startX);
    panY = mouseDrag.startPan.y + (e.clientY - mouseDrag.startY);
    clampPan();
    applyZoom();
  });
  window.addEventListener("mouseup", () => {
    mouseDrag = null;
  });
})();
