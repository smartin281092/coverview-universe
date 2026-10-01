import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/** Wallet card: a folded luminous plane over midnight blue, with very slow drift. */
export default function HealthShaderScene() {
  return (
    <ShaderGradientCanvas
      pixelDensity={1}
      fov={45}
      powerPreference="low-power"
      pointerEvents="none"
    >
      <ShaderGradient
        control="props"
        type="plane"
        shader="defaults"
        animate="on"
        uSpeed={0.045}
        uTime={1.2}
        uStrength={3.4}
        uDensity={1.3}
        uFrequency={4.5}
        uAmplitude={1}
        color1="#111e38"
        color2="#3b82f6"
        color3="#6366f1"
        positionX={0.3}
        rotationX={0}
        rotationY={0}
        rotationZ={45}
        cAzimuthAngle={180}
        cPolarAngle={90}
        cDistance={3.8}
        lightType="3d"
        brightness={1}
        reflection={0}
        grain="off"
        enableTransition={false}
        enableCameraUpdate={false}
      />
    </ShaderGradientCanvas>
  );
}
