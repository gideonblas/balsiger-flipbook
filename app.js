(function () {
  const PAGE_COUNT = 246;
  const bookEl = document.getElementById("book");
  const loadingEl = document.getElementById("loading");
  const indicatorEl = document.getElementById("page-indicator");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");

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
  }

  pageFlip.on("flip", updateIndicator);

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
})();
