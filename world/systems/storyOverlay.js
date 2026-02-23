export class StoryOverlay {
  constructor({ dataUrl = "./data/story-slides.json" } = {}) {
    this.dataUrl = dataUrl;
    this.slides = [];
    this.currentIndex = 0;

    this.root = null;
    this.image = null;
    this.title = null;
    this.body = null;
    this.counter = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.closeBtn = null;
  }

  async init() {
    this.slides = await this._loadSlides();
    this._buildDom();
  }

  isOpen() {
    return this.root?.classList.contains("is-open") ?? false;
  }

  open(index) {
    if (!this.root || this.slides.length === 0) return;

    this.currentIndex = Math.max(0, Math.min(index, this.slides.length - 1));
    this._renderCurrent();
    this.root.classList.add("is-open");
  }

  close() {
    if (!this.root) return;
    this.root.classList.remove("is-open");
  }

  _go(delta) {
    if (this.slides.length === 0) return;

    const len = this.slides.length;
    this.currentIndex = (this.currentIndex + delta + len) % len;
    this._renderCurrent();
  }

  _renderCurrent() {
    const slide = this.slides[this.currentIndex];
    if (!slide) return;

    this.image.src = slide.image;
    this.image.alt = slide.title;
    this.title.textContent = slide.title;
    this.body.textContent = slide.text;
    this.counter.textContent = `${this.currentIndex + 1} / ${this.slides.length}`;
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
        <button class="story-overlay__close" type="button" aria-label="Close">✕</button>
        <div class="story-overlay__media-wrap">
          <img class="story-overlay__media" src="" alt="" />
        </div>
        <div class="story-overlay__content">
          <h2 class="story-overlay__title"></h2>
          <p class="story-overlay__text"></p>
          <div class="story-overlay__footer">
            <button class="story-overlay__nav story-overlay__nav--prev" type="button">Previous</button>
            <span class="story-overlay__counter"></span>
            <button class="story-overlay__nav story-overlay__nav--next" type="button">Next</button>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(root);

    this.root = root;
    this.image = root.querySelector(".story-overlay__media");
    this.title = root.querySelector(".story-overlay__title");
    this.body = root.querySelector(".story-overlay__text");
    this.counter = root.querySelector(".story-overlay__counter");
    this.prevBtn = root.querySelector(".story-overlay__nav--prev");
    this.nextBtn = root.querySelector(".story-overlay__nav--next");
    this.closeBtn = root.querySelector(".story-overlay__close");

    root.querySelector(".story-overlay__backdrop").addEventListener("click", () => this.close());
    this.closeBtn.addEventListener("click", () => this.close());
    this.prevBtn.addEventListener("click", () => this._go(-1));
    this.nextBtn.addEventListener("click", () => this._go(1));

    root.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    window.addEventListener("keydown", (event) => {
      if (!this.isOpen()) return;
      if (event.key === "Escape") this.close();
      if (event.key === "ArrowLeft") this._go(-1);
      if (event.key === "ArrowRight") this._go(1);
    });
  }
}
