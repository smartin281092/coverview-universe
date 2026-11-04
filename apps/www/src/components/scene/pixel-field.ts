/**
 * Trame de pixels blancs qui scintillent, portage sans React du `PixelField` de Wallet
 * (page d’une offre, 8 octobre 2026) : une tuile de 32 × 32 points dessinée une fois par image
 * et répétée sur le canvas, chaque point à son propre rythme. Décoratif : immobile quand
 * l’utilisateur réduit les animations, arrêté hors écran ou dans un onglet masqué.
 */
const step = 4;
const tile = 128;

export class PixelField {
  private frame = 0;
  private previous = 0;
  private running = false;
  private still: boolean;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly pattern = document.createElement("canvas");
  private readonly pen: CanvasRenderingContext2D | null;
  private readonly ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  private readonly dots: {
    x: number;
    y: number;
    low: number;
    high: number;
    period: number;
    phase: number;
  }[];
  private readonly resize: ResizeObserver | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: { still?: boolean } = {},
  ) {
    this.still = options.still ?? false;
    this.context = canvas.getContext("2d");
    const side = tile * this.ratio;
    this.pattern.width = side;
    this.pattern.height = side;
    this.pen = this.pattern.getContext("2d");
    const perRow = tile / step;
    this.dots = Array.from({ length: perRow * perRow }, (_, index) => ({
      x: (index % perRow) * step * this.ratio,
      y: Math.floor(index / perRow) * step * this.ratio,
      low: Math.random() * 0.12,
      high: 0.15 + Math.random() * 0.22,
      period: 500 + Math.random() * 500,
      phase: Math.random() * Math.PI * 2,
    }));
    if (typeof ResizeObserver !== "undefined") {
      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(canvas);
    }
    this.fit();
  }

  private fit() {
    this.canvas.width = Math.ceil(this.canvas.clientWidth * this.ratio);
    this.canvas.height = Math.ceil(this.canvas.clientHeight * this.ratio);
    this.paint(performance.now());
  }

  private paint(time: number) {
    const { context, pen } = this;
    if (!context || !pen) return;
    const side = tile * this.ratio;
    pen.clearRect(0, 0, side, side);
    pen.fillStyle = "#ffffff";
    for (const dot of this.dots) {
      const wave = this.still
        ? 0.5
        : (1 - Math.cos((time / dot.period) * Math.PI * 2 + dot.phase)) / 2;
      pen.globalAlpha = dot.low + (dot.high - dot.low) * wave;
      pen.fillRect(dot.x, dot.y, this.ratio, this.ratio);
    }
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const fill = context.createPattern(this.pattern, "repeat");
    if (!fill) return;
    context.fillStyle = fill;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private readonly loop = (time: number) => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.loop);
    // Une trentaine d’images par seconde suffisent à un scintillement.
    if (time - this.previous < 33) return;
    this.previous = time;
    this.paint(time);
  };

  start() {
    if (this.running || this.still) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  setRunning(running: boolean) {
    if (running) this.start();
    else this.stop();
  }

  setStill(still: boolean) {
    this.still = still;
    if (still) {
      this.stop();
      this.paint(performance.now());
    }
  }

  destroy() {
    this.stop();
    this.resize?.disconnect();
  }
}
