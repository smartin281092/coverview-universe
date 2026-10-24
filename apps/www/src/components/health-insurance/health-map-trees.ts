// The low poly trees' icon (user request, 24 October 2026: « des arbres low poly pour les
// zones boisées »); their places come from scripts/health-map-trees.mjs.

// A low poly fir drawn once: two tiers of a cone, each with a lit and a shaded side.
export function treeImage() {
  const [width, height] = [40, 56];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#7c5434";
  context.fillRect(17, 42, 6, 14);
  const tier = (top: number, bottom: number, half: number) => {
    for (const [side, color] of [
      [-1, "#7cc35c"],
      [1, "#47924a"],
    ] as const) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(20, top);
      context.lineTo(20 + side * half, bottom);
      context.lineTo(20, bottom);
      context.closePath();
      context.fill();
    }
  };
  tier(16, 46, 18);
  tier(2, 32, 13);
  return context.getImageData(0, 0, width, height);
}
