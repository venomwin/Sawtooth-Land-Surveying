import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const canvas = document.querySelector("#successScene");
const reference = new URLSearchParams(window.location.search).get("id");
const referenceBox = document.querySelector("#applicationReference");
const applicationId = document.querySelector("#applicationId");
const genericReceipt = document.querySelector("#genericReceipt");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reference && /^[0-9]+$/.test(reference)) {
  applicationId.textContent = `#${reference}`;
  referenceBox.hidden = false;
} else {
  genericReceipt.hidden = false;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.8, 7.5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const environment = new THREE.Group();
const orbGroup = new THREE.Group();
const platformGroup = new THREE.Group();
const orbitalGroup = new THREE.Group();
const particleGroup = new THREE.Group();
environment.add(platformGroup, orbGroup, orbitalGroup, particleGroup);
scene.add(environment);

scene.add(new THREE.AmbientLight(0x0b1914, 2));
const keyLight = new THREE.DirectionalLight(0xdffff0, 3);
keyLight.position.set(3, 5, 5);
scene.add(keyLight);
const orbLight = new THREE.PointLight(0x3cff9b, 8, 8);
orbLight.position.set(1.8, 1.8, 3);
scene.add(orbLight);
const blueLight = new THREE.PointLight(0x66b9c9, 4, 9);
blueLight.position.set(-3, -1, 2);
scene.add(blueLight);

const orb = new THREE.Mesh(
  new THREE.SphereGeometry(1.45, 64, 64),
  new THREE.MeshPhysicalMaterial({ color: 0x123b2e, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.15, transmission: 0.35, thickness: 0.5 })
);
const innerOrb = new THREE.Mesh(
  new THREE.SphereGeometry(1.08, 48, 48),
  new THREE.MeshStandardMaterial({ color: 0x09291e, emissive: 0x0c6c49, emissiveIntensity: 0.65, transparent: true, opacity: 0.72, roughness: 0.25, metalness: 0.25 })
);
const wireShell = new THREE.Mesh(
  new THREE.SphereGeometry(1.53, 32, 24),
  new THREE.MeshBasicMaterial({ color: 0x75cdb1, wireframe: true, transparent: true, opacity: 0.12 })
);
orbGroup.add(orb, innerOrb, wireShell);

const checkShape = new THREE.Shape();
checkShape.moveTo(-0.85, 0);
checkShape.lineTo(-0.55, -0.3);
checkShape.lineTo(-0.05, -0.78);
checkShape.lineTo(0.9, 0.58);
checkShape.lineTo(0.65, 0.82);
checkShape.lineTo(-0.05, -0.12);
checkShape.lineTo(-0.42, 0.22);
checkShape.closePath();
const checkmark = new THREE.Mesh(
  new THREE.ExtrudeGeometry(checkShape, { depth: 0.22, bevelEnabled: true, bevelSegments: 5, bevelSize: 0.055, bevelThickness: 0.055, curveSegments: 8 }),
  new THREE.MeshStandardMaterial({ color: 0xd9ffe9, emissive: 0x4cff9b, emissiveIntensity: 1.8, metalness: 0.25, roughness: 0.18 })
);
checkmark.position.set(0, 0.15, 1.18);
checkmark.rotation.z = -0.08;
checkmark.scale.setScalar(0.01);
orbGroup.add(checkmark);

const ringMaterials = [
  new THREE.MeshBasicMaterial({ color: 0x39c27a, transparent: true, opacity: 0.66 }),
  new THREE.MeshBasicMaterial({ color: 0x75b9c7, transparent: true, opacity: 0.42 }),
  new THREE.MeshBasicMaterial({ color: 0x9ae8c2, transparent: true, opacity: 0.3 })
];
const rings = [
  new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.018, 16, 128), ringMaterials[0]),
  new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.014, 16, 128), ringMaterials[1]),
  new THREE.Mesh(new THREE.TorusGeometry(2.32, 0.01, 16, 128), ringMaterials[2])
];
rings[0].rotation.x = Math.PI * 0.2;
rings[1].rotation.y = Math.PI * 0.55;
rings[2].rotation.z = Math.PI * 0.35;
rings.forEach((ring) => orbitalGroup.add(ring));

const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xd9ffe9, emissive: 0x3cff9b, emissiveIntensity: 2, metalness: 0.2, roughness: 0.2 });
const nodes = Array.from({ length: 7 }, (_, index) => {
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), nodeMaterial);
  orbitalGroup.add(node);
  return { node, angle: (index / 7) * Math.PI * 2, radius: 1.75 + (index % 3) * 0.28, plane: index % 3 };
});

const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x081c16, emissive: 0x092d22, emissiveIntensity: 0.55, metalness: 0.82, roughness: 0.24 });
const platformLayers = [
  [new THREE.CylinderGeometry(2, 2.12, 0.18, 64), -1.82],
  [new THREE.CylinderGeometry(1.75, 1.88, 0.1, 64), -1.68],
  [new THREE.CylinderGeometry(1.45, 1.58, 0.05, 64), -1.59]
];
platformLayers.forEach(([geometry, y]) => {
  const mesh = new THREE.Mesh(geometry, platformMaterial);
  mesh.position.y = y;
  platformGroup.add(mesh);
});
const platformEdge = new THREE.Mesh(new THREE.TorusGeometry(1.83, 0.024, 8, 96), ringMaterials[0]);
platformEdge.rotation.x = Math.PI / 2;
platformEdge.position.y = -1.61;
platformGroup.add(platformEdge);

const gridMaterial = new THREE.LineBasicMaterial({ color: 0x39c27a, transparent: true, opacity: 0.2 });
const gridPositions = [];
for (let coordinate = -1.2; coordinate <= 1.2; coordinate += 0.3) {
  gridPositions.push(coordinate, -1.555, -1.2, coordinate, -1.555, 1.2);
  gridPositions.push(-1.2, -1.555, coordinate, 1.2, -1.555, coordinate);
}
platformGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3)), gridMaterial));

const curveMaterial = new THREE.MeshBasicMaterial({ color: 0x75b9c7, transparent: true, opacity: 0.22 });
[
  [[-2.5, 0.3, -0.5], [-1.2, 1.4, 0.4], [0, 1.7, 0.8], [1.4, 1, 0.2], [2.4, 0.2, -0.4]],
  [[-2.4, -0.35, 0.5], [-1, -1.2, 0.1], [0, -1.5, -0.4], [1.4, -0.8, 0.3], [2.5, -0.1, 0.7]]
].forEach((points) => {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  orbitalGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.008, 8, false), curveMaterial));
});

const particlePositions = new Float32Array(320 * 3);
for (let index = 0; index < 320; index += 1) {
  const radius = 2.4 + Math.random() * 2.2;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  particlePositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
  particlePositions[index * 3 + 1] = radius * Math.cos(phi) * 0.72;
  particlePositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
}
const particles = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3)),
  new THREE.PointsMaterial({ color: 0x75b9c7, size: 0.026, transparent: true, opacity: 0.48 })
);
particleGroup.add(particles);

const markerGroup = new THREE.Group();
for (let index = 0; index < 5; index += 1) {
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), nodeMaterial);
  marker.position.set(Math.cos(index * 1.7) * (2.1 + index * 0.12), -0.1 + Math.sin(index * 1.4) * 1.4, Math.sin(index * 1.7) * 0.8);
  markerGroup.add(marker);
}
environment.add(markerGroup);

let previousTime = 0;
let pulse = 0;
function resize() {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(time = 0) {
  const elapsed = time * 0.001;
  const delta = Math.min(elapsed - previousTime, 0.05);
  previousTime = elapsed;
  const entrance = Math.min(elapsed / 1.15, 1);
  const ease = 1 - Math.pow(1 - entrance, 3);
  platformGroup.position.y = -0.5 + ease * 0.5;
  platformGroup.scale.setScalar(0.82 + ease * 0.18);
  orbGroup.scale.setScalar(0.72 + ease * 0.28);
  checkmark.scale.setScalar(Math.min(Math.max((elapsed - 0.38) / 0.3, 0), 1));
  orbitalGroup.scale.setScalar(0.72 + Math.min(Math.max((elapsed - 0.65) / 0.45, 0), 1) * 0.28);
  particles.material.opacity = Math.min(Math.max((elapsed - 0.78) / 0.42, 0), 1) * 0.48;
  pulse = elapsed > 0.72 && elapsed < 1.2 ? Math.max(0, 1 - (elapsed - 0.72) / 0.48) : 0;
  orb.scale.setScalar(1 + pulse * 0.035);
  orbLight.intensity = 8 + pulse * 5;

  nodes.forEach((item, index) => {
    item.angle += delta * (0.22 + index * 0.012);
    const x = Math.cos(item.angle) * item.radius;
    const y = Math.sin(item.angle) * item.radius;
    if (item.plane === 0) item.node.position.set(x, y * 0.58, 0.2);
    if (item.plane === 1) item.node.position.set(x * 0.65, 0.2, y * 0.65);
    if (item.plane === 2) item.node.position.set(0.2, x * 0.58, y * 0.58);
  });

  if (!reducedMotion) {
    environment.position.y = Math.sin(elapsed * 0.8) * 0.07;
    orbGroup.rotation.y += delta * 0.08;
    rings[0].rotation.z += delta * 0.25;
    rings[1].rotation.x -= delta * 0.18;
    rings[2].rotation.y += delta * 0.12;
    particleGroup.rotation.y += delta * 0.012;
    markerGroup.rotation.y -= delta * 0.06;
    camera.position.x = Math.sin(elapsed * 0.15) * 0.08;
    camera.position.y = 0.8 + Math.sin(elapsed * 0.18) * 0.05;
    camera.lookAt(0, 0.5, 0);
  }

  renderer.render(scene, camera);
  if (!reducedMotion || elapsed < 1.2) window.requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();
animate();
