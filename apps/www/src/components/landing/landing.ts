import {
  chartPath,
  formatNumber,
  futureCapital,
  purchasingPower,
  savingsDefaults,
} from "./calculations";

const root = document.querySelector<HTMLElement>("[data-landing]");
if (root) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = motionPreference.matches;
  const numberFrames = new Map<HTMLElement, number>();
  const displayed = new WeakMap<HTMLElement, number>();
  root.querySelectorAll<HTMLElement>("[data-result]").forEach((element) => {
    const initial = Number(element.textContent?.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(initial)) displayed.set(element, initial);
  });
  const motionButton = root.querySelector<HTMLButtonElement>("[data-motion-toggle]");
  const pauseLabel = motionButton?.getAttribute("aria-label") ?? "";
  const playLabel = motionButton?.dataset.playLabel ?? "";
  let refreshWheel = () => {};
  function updateMotion() {
    if (!root) return;
    root.dataset.motion = paused ? "paused" : "running";
    motionButton?.setAttribute("aria-pressed", String(paused));
    motionButton?.setAttribute("aria-label", paused ? playLabel : pauseLabel);
    refreshWheel();
  }
  motionButton?.addEventListener("click", () => {
    paused = !paused;
    updateMotion();
  });
  motionPreference.addEventListener("change", () => {
    paused = motionPreference.matches;
    updateMotion();
  });
  updateMotion();

  function animateNumber(element: HTMLElement, target: number, digits = 0, initial?: number) {
    const previous = numberFrames.get(element);
    if (previous !== undefined) cancelAnimationFrame(previous);
    const start = initial ?? displayed.get(element) ?? target;
    const started = performance.now();
    function frame(now: number) {
      const progress = paused || motionPreference.matches ? 1 : Math.min((now - started) / 850, 1);
      const value = start + (target - start) * (1 - Math.pow(1 - progress, 4));
      displayed.set(element, value);
      element.textContent = formatNumber(value, digits);
      if (progress < 1) numberFrames.set(element, requestAnimationFrame(frame));
      else numberFrames.delete(element);
    }
    frame(started);
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.08, rootMargin: "0px 0px -25px 0px" },
  );
  root
    .querySelectorAll<HTMLElement>("[data-reveal]")
    .forEach((element) => revealObserver.observe(element));
  root.classList.add("motion-ready");

  const numberObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (!entry.isIntersecting) continue;
        if (element.dataset.count)
          animateNumber(
            element,
            Number(element.dataset.count),
            Number(element.dataset.countDigits ?? 0),
            0,
          );
        numberObserver.unobserve(element);
      }
    },
    { threshold: 0.5 },
  );
  root
    .querySelectorAll<HTMLElement>("[data-count]")
    .forEach((element) => numberObserver.observe(element));
  const sceneObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        (entry.target as HTMLElement).dataset.active = String(entry.isIntersecting);
    },
    { rootMargin: "100px" },
  );
  root
    .querySelectorAll<HTMLElement>("[data-scene]")
    .forEach((element) => sceneObserver.observe(element));

  const wheel = root.querySelector<HTMLElement>("[data-brand-wheel]");
  const rotor = wheel?.querySelector<HTMLElement>("[data-wheel-rotor]");
  if (wheel && rotor) {
    const cards = [...wheel.querySelectorAll<HTMLElement>("[data-wheel-card]")].map((card) => ({
      angle: Number(card.dataset.angle),
      face: card.querySelector<HTMLElement>("[data-wheel-face]"),
    }));
    let wheelFrame = 0;
    let lastTime = 0;
    let rotation = 0;
    let visible = true;
    const canRotate = () => visible && !paused && !motionPreference.matches && !document.hidden;
    const turn = (now: number) => {
      if (!canRotate()) {
        wheelFrame = 0;
        lastTime = 0;
        return;
      }
      if (lastTime) rotation = (rotation + (Math.min(now - lastTime, 64) * 360) / 44000) % 360;
      lastTime = now;
      rotor.style.transform = `rotateY(${rotation}deg)`;
      for (const card of cards) {
        const depth = (Math.cos(((card.angle + rotation) * Math.PI) / 180) + 1) / 2;
        if (card.face) card.face.style.opacity = String(0.12 + 0.88 * Math.pow(depth, 1.5));
      }
      wheelFrame = requestAnimationFrame(turn);
    };
    refreshWheel = () => {
      if (canRotate()) {
        if (!wheelFrame) wheelFrame = requestAnimationFrame(turn);
      } else {
        cancelAnimationFrame(wheelFrame);
        wheelFrame = 0;
        lastTime = 0;
      }
    };
    new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      refreshWheel();
    }).observe(wheel);
    refreshWheel();
  }

  root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      if (paused || motionPreference.matches || event.pointerType !== "mouse") return;
      const rect = element.getBoundingClientRect();
      element.style.setProperty(
        "--rx",
        `${(0.5 - (event.clientY - rect.top) / rect.height) * 22}deg`,
      );
      element.style.setProperty(
        "--ry",
        `${((event.clientX - rect.left) / rect.width - 0.5) * 30}deg`,
      );
    });
    element.addEventListener("pointerleave", () => {
      element.style.removeProperty("--rx");
      element.style.removeProperty("--ry");
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.openDialog ?? "");
      if (dialog instanceof HTMLDialogElement) dialog.showModal();
    });
  });
  root.querySelectorAll<HTMLElement>("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
  root.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    });
  });

  function rangePaint(input: HTMLInputElement) {
    if (input.type !== "range") return;
    const percent =
      ((input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty("--fill", `${percent}%`);
  }

  function bindInputs<T extends Record<string, number>>(
    section: HTMLElement,
    state: T,
    render: () => void,
  ) {
    const inputs = [...section.querySelectorAll<HTMLInputElement>("[data-input]")];
    function sync(source: HTMLInputElement, committed: boolean) {
      const key = source.dataset.input as keyof T;
      const raw = source.valueAsNumber;
      const min = Number(source.min),
        max = Number(source.max);
      if (!committed && (!Number.isFinite(raw) || raw < min || raw > max)) return;
      let value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : state[key];
      const step = Number(source.step);
      if (Number.isFinite(step) && step > 0) {
        const snapped = Number((min + Math.round((value - min) / step) * step).toFixed(6));
        if (!committed && Math.abs(snapped - value) > 0.000001) return;
        value = Math.min(max, Math.max(min, snapped));
      }
      if (key === "years") value = Math.round(value);
      state[key] = value as T[keyof T];
      for (const input of inputs) {
        if (input.dataset.input === key && (input !== source || committed))
          input.value = String(value);
        rangePaint(input);
      }
      section.querySelectorAll<HTMLElement>("[data-count]").forEach((element) => {
        delete element.dataset.count;
        numberObserver.unobserve(element);
      });
      render();
    }
    for (const input of inputs) {
      rangePaint(input);
      input.addEventListener("input", () => sync(input, false));
      input.addEventListener("change", () => sync(input, true));
      input.addEventListener("blur", () => sync(input, true));
    }
  }

  function numberResult(section: HTMLElement, key: string, value: number, digits = 0) {
    const element = section.querySelector<HTMLElement>(`[data-result="${key}"]`);
    if (element) animateNumber(element, value, digits);
  }

  const savings = root.querySelector<HTMLElement>("[data-savings]");
  if (savings) {
    const state: { monthly: number; years: number; rateA: number; rateB: number } = {
      ...savingsDefaults,
    };
    let graphState = { ...state };
    let graphFrame = 0;
    const pathA = savings.querySelector<SVGPathElement>('[data-path="a"]');
    const pathB = savings.querySelector<SVGPathElement>('[data-path="b"]');
    const fill = savings.querySelector<SVGPathElement>('[data-path="fill"]');
    const chartDot = savings.querySelector<SVGCircleElement>("[data-chart-dot]");
    const cursor = savings.querySelector<SVGLineElement>("[data-cursor]");
    const tooltip = savings.querySelector<HTMLElement>("[data-chart-tooltip]");
    function draw(next: typeof state) {
      const a = futureCapital(next.monthly, next.years, next.rateA / 100);
      const b = futureCapital(next.monthly, next.years, next.rateB / 100);
      const max = Math.max(a, b, 1);
      const d = chartPath(next.monthly, next.years, next.rateB / 100, max);
      pathA?.setAttribute("d", chartPath(next.monthly, next.years, next.rateA / 100, max));
      pathB?.setAttribute("d", d);
      fill?.setAttribute("d", `${d} L704,236 L16,236 Z`);
      chartDot?.setAttribute("cy", String(236 - (b / max) * 206));
      chartDot?.setAttribute("cx", "704");
      cursor?.setAttribute("x1", "704");
      cursor?.setAttribute("x2", "704");
    }
    function render() {
      if (!savings) return;
      const a = futureCapital(state.monthly, state.years, state.rateA / 100);
      const b = futureCapital(state.monthly, state.years, state.rateB / 100);
      for (const [key, value] of Object.entries({
        a,
        b,
        delta: Math.abs(b - a),
        invested: state.monthly * 12 * state.years,
        years: state.years,
      }))
        numberResult(savings, key, value);
      numberResult(savings, "rateA", state.rateA, 1);
      numberResult(savings, "rateB", state.rateB, 1);
      if (tooltip) tooltip.hidden = true;
      cancelAnimationFrame(graphFrame);
      const start = { ...graphState },
        target = { ...state },
        began = performance.now();
      function frame(now: number) {
        const t = paused || motionPreference.matches ? 1 : Math.min((now - began) / 650, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        graphState = {
          monthly: start.monthly + (target.monthly - start.monthly) * eased,
          years: start.years + (target.years - start.years) * eased,
          rateA: start.rateA + (target.rateA - start.rateA) * eased,
          rateB: start.rateB + (target.rateB - start.rateB) * eased,
        };
        draw(graphState);
        if (t < 1) graphFrame = requestAnimationFrame(frame);
      }
      graphFrame = requestAnimationFrame(frame);
    }
    bindInputs(savings, state, render);
    const chart = savings.querySelector<HTMLElement>("[data-chart]");
    chart?.addEventListener("pointermove", (event) => {
      const rect = chart.getBoundingClientRect();
      const fraction = Math.min(
        1,
        Math.max(0, (((event.clientX - rect.left) / rect.width) * 720 - 16) / 688),
      );
      const years = state.years * fraction;
      const a = futureCapital(state.monthly, years, state.rateA / 100),
        b = futureCapital(state.monthly, years, state.rateB / 100);
      const max = Math.max(
        futureCapital(state.monthly, state.years, state.rateA / 100),
        futureCapital(state.monthly, state.years, state.rateB / 100),
        1,
      );
      const x = 16 + fraction * 688;
      cursor?.setAttribute("x1", String(x));
      cursor?.setAttribute("x2", String(x));
      chartDot?.setAttribute("cx", String(x));
      chartDot?.setAttribute("cy", String(236 - (b / max) * 206));
      if (tooltip) {
        tooltip.hidden = false;
        tooltip.style.left = `${Math.min(78, Math.max(22, fraction * 100))}%`;
        tooltip.textContent = `${formatNumber(years, 1)} ${savings.dataset.yearsLabel}\n${savings.dataset.labelA} : ${formatNumber(a)} CHF\n${savings.dataset.labelB} : ${formatNumber(b)} CHF`;
      }
    });
    chart?.addEventListener("pointerleave", () => {
      if (tooltip) tooltip.hidden = true;
      draw(state);
    });
  }

  const inflation = root.querySelector<HTMLElement>("[data-inflation]");
  if (inflation) {
    const state = { capital: 300000, years: 30, inflation: 4 };
    bindInputs(inflation, state, () => {
      const power = purchasingPower(state.capital, state.years, state.inflation / 100);
      const fraction = state.capital ? power / state.capital : 1;
      numberResult(inflation, "power", power);
      numberResult(inflation, "loss", (1 - fraction) * 100);
      inflation
        .querySelector<HTMLElement>("[data-power-mask]")
        ?.style.setProperty("--power", `${fraction * 100}%`);
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) root.dataset.motion = "paused";
    else updateMotion();
    refreshWheel();
  });
}
