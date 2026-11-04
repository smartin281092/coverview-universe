import { useSyncExternalStore } from "react";
import type { Frequency } from "./hyperion-model";

// The buy box of the hero and the simulator further down are two islands: they share the same
// parameters through this module, loaded once by the page. The order dialog opens on a DOM event
// so that static buttons of the page can open it too.
export type HyperionConfig = {
  investment: number;
  frequency: Frequency;
  birthYear: number;
  initialCapital: number;
};
const defaultConfig: HyperionConfig = {
  investment: 300,
  frequency: "monthly",
  birthYear: 1992,
  initialCapital: 0,
};
export const ORDER_EVENT = "hyperion:order";

let config = defaultConfig;
const listeners = new Set<() => void>();
const readConfig = () => config;
export function updateConfig(patch: Partial<HyperionConfig>) {
  config = { ...config, ...patch };
  for (const listener of listeners) listener();
}
function subscribeConfig(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const useHyperionConfig = () =>
  useSyncExternalStore(subscribeConfig, readConfig, () => defaultConfig);
export const requestOrder = () => document.dispatchEvent(new CustomEvent(ORDER_EVENT));
