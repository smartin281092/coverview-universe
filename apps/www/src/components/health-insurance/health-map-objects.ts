import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Camera,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibre } from "maplibre-gl";
import { objectsLayerId } from "./health-map-style";

// The low poly view's objects in real 3D (user request, 24 October 2026: « Ajoute des
// maisons et immeubles en vrai 3D low poly dans les zones rurales et villes. Fait les arbres
// en vrai 3D aussi low poly »): firs, houses, buildings and towers with flat faces, drawn by
// three.js inside the map, every copy of a shape in one draw. Their places come from
// public/map/objects-v1.json (scripts/health-map-objects.mjs).

type Item = [
  longitude: number,
  latitude: number,
  elevation: number,
  level: number,
  size: number,
  angle: number,
];
type Objects = Record<"trees" | "houses" | "buildings" | "towers", Item[]>;

// Larger than life, and larger from afar, so that they stay visible: twice as large every
// 1.5 zoom levels out.
const scaleAt = (zoom: number) => 1.6 * 2 ** (0.65 * (10 - Math.max(6, Math.min(10, zoom))));
// Level 0 from afar, level 1 from zoom 8, level 2 from zoom 9, as the file says.
const levelAt = (zoom: number) => (zoom < 8 ? 0 : zoom < 9 ? 1 : 2);

// Three's cones and cylinders stand along y; the map's scene stands along z (metres, base at
// 0). Flat faces: no vertex shared between two of them.
const upright = (geometry: BufferGeometry, base: number) =>
  geometry
    .rotateX(Math.PI / 2)
    .translate(0, 0, base)
    .toNonIndexed();
const box = (x: number, y: number, z: number, base: number) =>
  new BoxGeometry(x, y, z).translate(0, 0, base + z / 2).toNonIndexed();
// A gable roof: a triangular prism along x, its ridge up, flattened to a gentle slope.
const roof = (length: number, width: number, base: number) => {
  const radius = width / Math.sqrt(3);
  return new CylinderGeometry(radius, radius, length, 3)
    .rotateZ(-Math.PI / 2)
    .scale(1, 1, 0.6)
    .translate(0, 0, base + radius * 0.3)
    .toNonIndexed();
};
// One shape from coloured parts: a single geometry, so that all its copies draw at once.
const shape = (parts: [BufferGeometry, string][]) => {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (const [geometry, hex] of parts) {
    geometry.computeVertexNormals();
    const color = new Color(hex);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    for (let index = 0; index < position.count; index++) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
};
const shapes: Record<keyof Objects, BufferGeometry> = {
  trees: shape([
    [upright(new CylinderGeometry(35, 45, 160, 5), 80), "#7a5232"],
    [upright(new ConeGeometry(260, 380, 6), 330), "#4c9a48"],
    [upright(new ConeGeometry(190, 300, 6), 530), "#5aa652"],
  ]),
  houses: shape([
    [box(420, 300, 230, 0), "#f4eee3"],
    [roof(450, 340, 230), "#c8553d"],
  ]),
  buildings: shape([
    [box(380, 380, 700, 0), "#e4e0d8"],
    [box(410, 410, 40, 700), "#9aa3ad"],
  ]),
  towers: shape([
    [box(330, 330, 1400, 0), "#a9c2db"],
    [box(220, 220, 160, 1400), "#7e8fa3"],
  ]),
};
// Copies vary a little in tone.
const tints = [1, 0.93, 0.86].map((value) => new Color(value, value, value));

let objects: Promise<Objects> | null = null;

// The custom layer: one instanced mesh per shape and level; the scene's units are metres
// from Switzerland's centre, x east, y south as on the map, z up.
export function objectsLayer(map: MapLibre, url: string, exaggeration: number) {
  objects ??= fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json() as Promise<Objects>;
  });
  const origin = MercatorCoordinate.fromLngLat([8.23, 46.8]);
  const unit = origin.meterInMercatorCoordinateUnits();
  // From the scene's metres to the map's Mercator coordinates.
  const local = new Matrix4()
    .makeTranslation(origin.x, origin.y, 0)
    .scale(new Vector3(unit, unit, unit));
  const scale = { value: scaleAt(map.getZoom()) };
  const meshes: { mesh: InstancedMesh; level: number }[] = [];
  const scene = new Scene();
  const camera = new Camera();
  let renderer: WebGLRenderer | null = null;
  scene.add(new AmbientLight(0xffffff, 1.6));
  const sun = new DirectionalLight(0xffffff, 2.2);
  // From the north-west and high, as the relief's shading.
  sun.position.set(-1, -1.2, 2.2);
  scene.add(sun);
  const material = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
  // Each copy grows around its own base with the zoom.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.objectScale = scale;
    shader.vertexShader = `uniform float objectScale;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "vec3 transformed = vec3( position ) * objectScale;",
    );
  };

  const build = (data: Objects) => {
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const up = new Vector3(0, 0, 1);
    const position = new Vector3();
    const size = new Vector3();
    for (const [kind, geometry] of Object.entries(shapes) as [keyof Objects, BufferGeometry][])
      for (const level of [0, 1, 2]) {
        const items = data[kind].filter((item) => item[3] === level);
        if (!items.length) continue;
        const mesh = new InstancedMesh(geometry, material, items.length);
        mesh.frustumCulled = false;
        items.forEach(([longitude, latitude, elevation, , factor, angle], index) => {
          const at = MercatorCoordinate.fromLngLat([longitude, latitude], elevation * exaggeration);
          matrix.compose(
            position.set((at.x - origin.x) / unit, (at.y - origin.y) / unit, at.z / unit),
            turn.setFromAxisAngle(up, (angle * Math.PI) / 180),
            size.set(factor, factor, factor),
          );
          mesh.setMatrixAt(index, matrix);
          mesh.setColorAt(index, tints[index % tints.length] ?? new Color(1, 1, 1));
        });
        scene.add(mesh);
        meshes.push({ mesh, level });
      }
    map.triggerRepaint();
  };

  const layer: CustomLayerInterface = {
    id: objectsLayerId,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      void objects?.then(build).catch(() => {
        // Without the file, the low poly view stays usable, without objects.
      });
    },
    render(gl, args) {
      if (!renderer) return;
      const zoom = map.getZoom();
      scale.value = scaleAt(zoom);
      const shown = levelAt(zoom);
      for (const { mesh, level } of meshes) mesh.visible = level <= shown;
      camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
    },
    onRemove() {
      for (const { mesh } of meshes) mesh.dispose();
      material.dispose();
      renderer?.dispose();
      renderer = null;
    },
  };
  return layer;
}
