import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GameId } from './data';

type SceneVariant = GameId | 'menu';

const COLORS = {
  ink: 0x19383b,
  lime: 0xe0f17d,
  green: 0x74ba75,
  paleGreen: 0xa8d17d,
  blue: 0x79bac9,
  ice: 0xe4eedb,
  coral: 0xef826d,
  orange: 0xf4c95d,
  violet: 0xa994d8,
  mint: 0x88d2b1,
  paper: 0xf8f6e9,
};

export default function ThreeScene({ variant, className = '' }: { variant: SceneVariant; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 100);
    camera.position.set(0, 1.2, 20);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x65705e, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
    keyLight.position.set(-4, 8, 10);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffbe80, 1.4);
    fillLight.position.set(5, -3, 8);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);
    const floaters: Array<{ mesh: THREE.Object3D; y: number; speed: number; spin: number; phase: number }> = [];
    const materials = new Set<THREE.Material>();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const material = (color: number, roughness = 0.76) => {
      const value = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness, metalness: 0.02 });
      materials.add(value);
      return value;
    };

    const addMesh = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z = 0, scale = 1) => {
      const mesh = new THREE.Mesh(geometry, material(color));
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };

    const addFloater = (mesh: THREE.Object3D, speed = 0.8, spin = 0.25, phase = 0) => {
      floaters.push({ mesh, y: mesh.position.y, speed, spin, phase });
    };

    const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number) =>
      addMesh(new THREE.BoxGeometry(sx, sy, sz), color, x, y, z);

    if (variant === 'menu') {
      const forms = [
        { x: -5.5, y: 1.8, size: 1.15, color: COLORS.lime, geo: new THREE.IcosahedronGeometry(1, 0) },
        { x: -3.6, y: -1.8, size: 0.72, color: COLORS.coral, geo: new THREE.OctahedronGeometry(1, 0) },
        { x: -1.3, y: 1.5, size: 0.82, color: COLORS.blue, geo: new THREE.DodecahedronGeometry(1, 0) },
        { x: 1.1, y: -1.55, size: 1.2, color: COLORS.orange, geo: new THREE.IcosahedronGeometry(1, 0) },
        { x: 3.65, y: 1.65, size: 1.03, color: COLORS.mint, geo: new THREE.OctahedronGeometry(1, 0) },
        { x: 5.65, y: -1.05, size: 0.77, color: COLORS.violet, geo: new THREE.TetrahedronGeometry(1, 0) },
        { x: -6.7, y: -0.15, size: 0.48, color: COLORS.orange, geo: new THREE.TetrahedronGeometry(1, 0) },
        { x: 6.6, y: 0.8, size: 0.46, color: COLORS.coral, geo: new THREE.DodecahedronGeometry(1, 0) },
      ];
      forms.forEach((form, index) => {
        const mesh = addMesh(form.geo, form.color, form.x, form.y, (index % 3) * 0.3, form.size);
        mesh.rotation.set(index * 0.4, index * 0.27, index * 0.19);
        addFloater(mesh, 0.5 + index * 0.08, (index % 2 ? 1 : -1) * 0.22, index * 0.7);
      });
      const small = new THREE.OctahedronGeometry(0.28, 0);
      [[-4.5, 2.8], [-0.1, -2.7], [2.2, 2.85], [5.1, 2.75]].forEach(([x, y], index) => {
        const mesh = addMesh(small, index % 2 ? COLORS.ice : COLORS.coral, x, y, 0.2, 0.75);
        addFloater(mesh, 1.1, 0.5, index);
      });
    } else if (variant === 'slither') {
      const ground = new THREE.Shape();
      ground.moveTo(-8, -2.1);
      ground.quadraticCurveTo(-5.5, -2.25, -4.1, -0.7);
      ground.quadraticCurveTo(-2.2, 1.1, 0, -0.1);
      ground.quadraticCurveTo(2.2, -1.2, 4.3, -0.2);
      ground.quadraticCurveTo(6, 0.5, 8, -0.9);
      ground.lineTo(8, -4);
      ground.lineTo(-8, -4);
      ground.closePath();
      const terrain = new THREE.Mesh(new THREE.ShapeGeometry(ground), material(COLORS.green));
      terrain.position.z = -0.8;
      root.add(terrain);
      [-1, 1].forEach((side, index) => {
        const color = index ? COLORS.coral : COLORS.violet;
        for (let segment = 0; segment < 5; segment += 1) {
          const x = side < 0 ? -5.6 + segment * 0.56 : 5.6 - segment * 0.56;
          const y = side < 0 ? -0.8 + segment * 0.12 : -0.4 - segment * 0.08;
          const mesh = addMesh(new THREE.DodecahedronGeometry(0.48, 0), color, x, y, 0.5, 1);
          mesh.scale.set(0.86, 0.72, 0.8);
          if (segment === 0) addFloater(mesh, 1.2, 0.1, index * 2);
        }
      });
      addMesh(new THREE.IcosahedronGeometry(0.22, 0), COLORS.orange, 0.5, 1.05, 0.8, 1);
      addMesh(new THREE.ConeGeometry(0.36, 0.7, 4), COLORS.ice, -0.1, 1.7, 0.7, 0.8);
    } else if (variant === 'dino') {
      [-6.1, -3.8, 3.8, 6.2].forEach((x, index) => {
        const mountain = addMesh(new THREE.ConeGeometry(1.65 + (index % 2) * 0.45, 3.4 + (index % 2) * 0.8, 4), index % 2 ? COLORS.orange : 0xd7a17a, x, -0.85, -1.8, 1);
        mountain.rotation.z = index % 2 ? 0.2 : -0.22;
      });
      addBox(0, -2.5, 0, 16, 0.45, 2.1, 0x73544b);
      addBox(0, -2.22, 0.18, 16, 0.08, 2.15, 0xf3c47a);

      const dino = new THREE.Group();
      dino.position.set(-1.45, -0.65, 0.6);
      root.add(dino);
      const dinoPart = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
        const part = new THREE.Mesh(geo, material(color));
        part.position.set(x, y, z);
        dino.add(part);
      };
      dinoPart(new THREE.BoxGeometry(1.65, 0.88, 0.8), 0x4b795b, 0, -0.1, 0);
      dinoPart(new THREE.BoxGeometry(0.95, 0.76, 0.73), 0x5f9160, 0.82, 0.48, 0);
      dinoPart(new THREE.BoxGeometry(0.66, 0.52, 0.68), 0x5f9160, 1.42, 0.37, 0);
      dinoPart(new THREE.BoxGeometry(0.36, 0.14, 0.12), COLORS.paper, 1.16, 0.67, 0.39);
      dinoPart(new THREE.BoxGeometry(0.27, 0.22, 0.35), 0x304b44, 0.1, -0.72, 0.04);
      dinoPart(new THREE.BoxGeometry(0.27, 0.22, 0.35), 0x304b44, 0.84, -0.72, -0.12);
      const tail = new THREE.ConeGeometry(0.52, 1.2, 4);
      const tailMesh = new THREE.Mesh(tail, material(0x3f674f));
      tailMesh.rotation.z = Math.PI / 2;
      tailMesh.position.set(-1.05, -0.06, 0);
      dino.add(tailMesh);
      addFloater(dino, 1.1, 0.015, 0);

      [-4.7, 4.45].forEach((x, index) => {
        const color = index ? COLORS.green : 0x5b985b;
        addBox(x, -1.45, 0.3, 0.38, 1.35, 0.42, color);
        addBox(x - 0.32, -1.18, 0.3, 0.34, 0.68, 0.4, color);
        addBox(x + 0.3, -1.2, 0.3, 0.33, 0.72, 0.4, color);
      });
      const sun = addMesh(new THREE.IcosahedronGeometry(0.76, 0), COLORS.orange, 5.4, 2.2, -2, 1);
      addFloater(sun, 0.6, 0.08, 1);
    } else if (variant === 'snake') {
      addBox(0, -1.75, -1, 11.8, 0.12, 5, 0x94dca7);
      const body = [
        [-2.55, -0.95], [-1.72, -0.95], [-0.9, -0.95], [-0.9, -0.1], [-0.08, -0.1], [0.74, -0.1],
      ];
      body.forEach(([x, y], index) => {
        const head = index === body.length - 1;
        const block = addBox(x, y, 0.45, 0.72, 0.68, 0.72, head ? 0x4f9f68 : 0x63ba7c);
        block.rotation.y = 0.18;
        addFloater(block, 0.36 + index * 0.03, index % 2 ? 0.035 : -0.02, index * 0.3);
      });
      const apple = addMesh(new THREE.DodecahedronGeometry(0.48, 0), COLORS.coral, 2.55, 0.7, 0.5, 1);
      addFloater(apple, 1.3, 0.17, 2);
      addMesh(new THREE.ConeGeometry(0.13, 0.34, 4), COLORS.green, 2.72, 1.14, 0.55, 1);
    } else if (variant === 'minesweeper') {
      const tileColors = [COLORS.ice, 0xd6e1ff, 0xb7c5fb, 0xe7ebfa, 0x9caff0, COLORS.ice, 0xd6e1ff, 0xb7c5fb, 0xe7ebfa];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const x = (column - 1.5) * 1.35 + (row % 2) * 0.28;
          const y = (1 - row) * 1.15;
          const tile = addBox(x, y, 0.2 + row * 0.1, 1.12, 0.78, 0.35, tileColors[row * 3 + column]);
          tile.rotation.z = (row - 1) * -0.035;
          if ((row === 0 && column === 1) || (row === 2 && column === 3)) {
            const mine = addMesh(new THREE.IcosahedronGeometry(0.34, 0), COLORS.ink, x, y + 0.1, 0.65, 1);
            addFloater(mine, 0.9, 0.2, row + column);
          }
          if (row === 1 && column === 3) {
            const flag = addMesh(new THREE.ConeGeometry(0.3, 0.48, 3), COLORS.coral, x + 0.1, y + 0.7, 0.65, 1);
            flag.rotation.z = -Math.PI / 2;
          }
        }
      }
    } else {
      const cells = [
        [-2.1, 1.35, COLORS.violet], [-0.9, 1.35, COLORS.ice], [0.3, 1.35, COLORS.coral],
        [-2.1, 0.15, COLORS.ice], [-0.9, 0.15, COLORS.orange], [0.3, 0.15, COLORS.ice],
        [-2.1, -1.05, COLORS.mint], [-0.9, -1.05, COLORS.ice], [0.3, -1.05, COLORS.violet],
      ];
      cells.forEach(([x, y, color], index) => {
        const tile = addBox(x, y, 0.3, 1.05, 1.05, 0.42, color);
        tile.rotation.z = index % 2 ? -0.025 : 0.025;
      });
      const sparks = [
        [-3.45, 0.88, COLORS.ice], [1.85, 1.5, COLORS.coral], [1.75, -1.35, COLORS.orange], [-3.3, -1.55, COLORS.mint],
      ];
      sparks.forEach(([x, y, color], index) => {
        const spark = addMesh(new THREE.OctahedronGeometry(0.34, 0), color, x, y, 0.8, 1);
        addFloater(spark, 0.65, 0.25, index);
      });
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const viewHeight = 8.2;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      const spread = Math.max(0.82, Math.min(1.45, aspect / 1.8));
      root.scale.x = spread;
      if (prefersReducedMotion) renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = (now: number) => {
      const seconds = now / 1000;
      if (!prefersReducedMotion) {
        floaters.forEach(({ mesh, y, speed, spin, phase }) => {
          mesh.position.y = y + Math.sin(seconds * speed + phase) * 0.12;
          mesh.rotation.y += spin * 0.008;
          mesh.rotation.x += spin * 0.004;
        });
      }
      renderer.render(scene, camera);
      if (!prefersReducedMotion) frame = window.requestAnimationFrame(animate);
    };
    if (prefersReducedMotion) renderer.render(scene, camera);
    else frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      materials.forEach((value) => value.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div aria-hidden="true" className={`three-scene ${className}`} ref={hostRef} />;
}
