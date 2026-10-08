import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

/**
 * The offer page's background (8 October 2026): shadergradient.co's "Halo" preset in the
 * company's colours. Decorative only, loaded with its own chunk when an offer opens.
 */
export default function OfferShader({
  colors,
  still,
}: {
  colors: readonly [string, string, string];
  still: boolean;
}) {
  return (
    <ShaderGradientCanvas
      pixelDensity={1}
      fov={45}
      powerPreference="low-power"
      pointerEvents="none"
      style={{ position: "absolute", inset: 0 }}
    >
      <ShaderGradient
        control="props"
        type="plane"
        shader="defaults"
        animate={still ? "off" : "on"}
        uTime={0}
        uSpeed={0.2}
        uStrength={4}
        uDensity={1.3}
        uFrequency={5.5}
        uAmplitude={1}
        color1={colors[1]}
        color2={colors[0]}
        color3={colors[2]}
        positionX={-1.4}
        positionY={0}
        positionZ={0}
        rotationX={0}
        rotationY={10}
        rotationZ={50}
        cAzimuthAngle={180}
        cPolarAngle={90}
        cDistance={3.6}
        cameraZoom={1}
        lightType="3d"
        brightness={1.2}
        envPreset="city"
        reflection={0.1}
        grain="on"
        enableTransition={false}
        enableCameraUpdate={false}
      />
    </ShaderGradientCanvas>
  );
}
