export class StoryOverlay {
  constructor({ dataUrl = "./data/story-slides.json" } = {}) {
    this.dataUrl = dataUrl;
    this.allSlides = [];
    this.slides = [];
    this.currentIndex = 0;
    this.maxVisitedIndex = -1;

    this.root = null;
    this.card = null;
    this.image = null;
    this.title = null;
    this.body = null;
    this.counter = null;
    this.prevBtn = null;
    this.outsideHint = null;

    this.openedAt = 0;
    this.minCloseDelayMs = 3000;
  }

  async init() {
    this.allSlides = await this._loadSlides();
    this.slides = this.allSlides.length > 1 ? this.allSlides.slice(0, -1) : this.allSlides;
    this._buildDom();
  }

  isOpen() {
    return this.root?.classList.contains("is-open") ?? false;
  }

  hasSlide(index) {
    return index >= 0 && index < this.slides.length;
  }

  getEndingSlide() {
    return this.allSlides[this.allSlides.length - 1] || {
      title: "The End",
      text: "The constellation has completed.",
      image: "./star.png"
    };
  }

  open(index) {
    if (!this.root || this.slides.length === 0 || !this.hasSlide(index)) return;

    this.maxVisitedIndex = Math.max(this.maxVisitedIndex, index);
    this.currentIndex = Math.min(index, this.maxVisitedIndex);
    this.openedAt = performance.now();

    this._renderCurrent();
    this.root.classList.add("is-open");

    this.outsideHint.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!this.isOpen()) return;
      this.outsideHint.classList.add("is-visible");
    }, this.minCloseDelayMs);
  }

  close({ recapturePointer = false } = {}) {
    if (!this.root) return;

    this.root.classList.remove("is-open");
    this.outsideHint.classList.remove("is-visible");

    if (recapturePointer) {
      document.body.requestPointerLock?.();
    }
  }

  _goPrevious() {
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    this._renderCurrent();
  }

  _renderCurrent() {
    const slide = this.slides[this.currentIndex];
    if (!slide) return;

    this.image.src = slide.image;
    this.image.alt = slide.title;
    this.title.textContent = slide.title;
    this.body.textContent = slide.text;
    this.counter.textContent = `${this.currentIndex + 1} / ${this.maxVisitedIndex + 1}`;

    this.prevBtn.disabled = this.currentIndex <= 0;
  }

  async _loadSlides() {
    try {
      const response = await fetch(this.dataUrl);
      if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
      const data = await response.json();

      if (!Array.isArray(data.slides)) return [];

      return data.slides.map((slide, i) => ({
        title: slide.title || `Memory ${i + 1}`,
        text: slide.text || "",
        image: slide.image || "./star.png"
      }));
    } catch (error) {
      console.error("StoryOverlay: could not load slides", error);
      return [];
    }
  }

  _buildDom() {
    const root = document.createElement("div");
    root.className = "story-overlay";

    root.innerHTML = `
      <div class="story-overlay__backdrop"></div>
      <section class="story-overlay__card" role="dialog" aria-modal="true" aria-label="Story memory">
        <div class="story-overlay__media-wrap">
          <img class="story-overlay__media" src="" alt="" />
        </div>
        <div class="story-overlay__content">
          <h2 class="story-overlay__title"></h2>
          <p class="story-overlay__text"></p>
          <div class="story-overlay__footer">
            <button class="story-overlay__nav story-overlay__nav--prev" type="button">Previous</button>
            <span class="story-overlay__counter"></span>
          </div>
        </div>
      </section>
      <div class="story-overlay__outside-hint">Click outside the box to continue</div>
    `;

    document.body.appendChild(root);

    this.root = root;
    this.card = root.querySelector(".story-overlay__card");
    this.image = root.querySelector(".story-overlay__media");
    this.title = root.querySelector(".story-overlay__title");
    this.body = root.querySelector(".story-overlay__text");
    this.counter = root.querySelector(".story-overlay__counter");
    this.prevBtn = root.querySelector(".story-overlay__nav--prev");
    this.outsideHint = root.querySelector(".story-overlay__outside-hint");

    this.prevBtn.addEventListener("click", () => this._goPrevious());

    root.addEventListener("click", (event) => {
      if (!this.isOpen()) return;
      if (this.card.contains(event.target)) return;

      const canClose = performance.now() - this.openedAt >= this.minCloseDelayMs;
      if (!canClose) return;

      this.close({ recapturePointer: true });
    });

    window.addEventListener("keydown", (event) => {
      if (!this.isOpen()) return;
      if (event.key === "ArrowLeft") this._goPrevious();
    });
  }
}
