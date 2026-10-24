import { useEffect, useState, type ComponentProps } from "react";
import type { SwissPremiumMap } from "./SwissPremiumMap";
import type { SwissPremiumMap3D } from "./SwissPremiumMap3D";

type Props = ComponentProps<typeof SwissPremiumMap>;
type Loaded =
  { kind: "3d"; Map: typeof SwissPremiumMap3D } | { kind: "svg"; Map: typeof SwissPremiumMap };

// The 3D map (24 October 2026) loads after the rest of the comparator; without WebGL2, or if
// it cannot load, the SVG map takes its place.
export function HealthPremiumMap(props: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const svg = () => {
    void import("./SwissPremiumMap").then((module) =>
      setLoaded({ kind: "svg", Map: module.SwissPremiumMap }),
    );
  };
  useEffect(() => {
    import("./SwissPremiumMap3D").then(
      (module) => setLoaded({ kind: "3d", Map: module.SwissPremiumMap3D }),
      svg,
    );
  }, []);
  if (loaded?.kind === "3d") return <loaded.Map {...props} onUnavailable={svg} />;
  if (loaded?.kind === "svg") return <loaded.Map {...props} />;
  return (
    <div className="hi-map-wrap" aria-busy="true">
      <div className="hi-map-stage">
        <div className="hi-map hi-map-3d" />
      </div>
    </div>
  );
}
