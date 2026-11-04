import { formatFrancs } from "./hyperion-model";

// The page's own behaviours: reveal on scroll, counters, dialogs, the reviews' pause button and
// the order event of the static buttons. Islands handle their own state.
const root = document.querySelector<HTMLElement>("[data-hyperion]");
if (root) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = () => {
    root.dataset.motion = reduced.matches ? "paused" : "running";
  };
  reduced.addEventListener("change", applyMotion);
  applyMotion();

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

  const counterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        counterObserver.unobserve(element);
        const target = Number(element.dataset.count);
        const digits = Number(element.dataset.countDigits ?? 0);
        if (!Number.isFinite(target) || reduced.matches) continue;
        const started = performance.now();
        const frame = (now: number) => {
          const progress = Math.min((now - started) / 900, 1);
          const value = target * (1 - Math.pow(1 - progress, 4));
          element.textContent = formatFrancs(value, digits);
          if (progress < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }
    },
    { threshold: 0.5 },
  );
  root
    .querySelectorAll<HTMLElement>("[data-count]")
    .forEach((element) => counterObserver.observe(element));

  // Dialog buttons are delegated: the simulator island renders one of them.
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const opener = target?.closest<HTMLElement>("[data-open-dialog]");
    if (opener) {
      const dialog = document.getElementById(opener.dataset.openDialog ?? "");
      if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      return;
    }
    if (target?.closest("[data-close-dialog]")) {
      target.closest("dialog")?.close();
      return;
    }
    if (target?.closest("[data-open-order]"))
      document.dispatchEvent(new CustomEvent("hyperion:order"));
  });
  root.querySelectorAll<HTMLDialogElement>("dialog:not(.hp-order)").forEach((dialog) => {
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

  const reviews = root.querySelector<HTMLElement>("[data-reviews]");
  const toggle = root.querySelector<HTMLButtonElement>("[data-reviews-toggle]");
  if (reviews && toggle) {
    const pauseLabel = toggle.textContent ?? "";
    const playLabel = toggle.dataset.playLabel ?? pauseLabel;
    toggle.addEventListener("click", () => {
      const paused = reviews.dataset.paused !== "true";
      reviews.dataset.paused = String(paused);
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.textContent = paused ? playLabel : pauseLabel;
    });
  }
}
