import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

/**
 * The LPP page's hero (4 November 2026): the plane of Wallet's offer pages in CoverView's
 * midnight, indigo and blue, under a blur and the flickering pixels. Decorative only.
 */
export default function PensionShaderScene({ still }: { still: boolean }) {
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
        uSpeed={0.18}
        uStrength={4}
        uDensity={1.3}
        uFrequency={5.5}
        uAmplitude={1}
        color1="#5654e8"
        color2="#1d3a8a"
        color3="#60a5fa"
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
        brightness={1.3}
        envPreset="city"
        reflection={0.1}
        grain="on"
        enableTransition={false}
        enableCameraUpdate={false}
      />
    </ShaderGradientCanvas>
  );
}
