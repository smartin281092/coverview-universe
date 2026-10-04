/** AbortSignal.any is absent from some embedded browsers. Keep timeout + cancellation portable. */
export function healthRequestSignal(parent?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (parent?.aborted) cancel();
  else parent?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 30000);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", cancel);
    },
  };
}
