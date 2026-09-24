import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Status = 'ready' | 'running' | 'over';
type ObstacleKind = 'cactus' | 'bird' | 'rock';

interface Obstacle {
  group: THREE.Group;
  kind: ObstacleKind;
  width: number;
  gap: number;
}

const OBSTACLE_WIDTHS: Record<ObstacleKind, number> = { cactus: 1, bird: 1.3, rock: 1.8 };
const INITIAL_SPEED = 8.1;

export default function DinoGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<Status>('ready');
  const jumpRef = useRef(false);
  const duckRef = useRef(false);
  const resetRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [ducking, setDucking] = useState(false);

  const changeStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const startRun = () => {
    if (statusRef.current === 'running') {
      jumpRef.current = true;
      return;
    }
    resetRef.current?.();
    setScore(0);
    changeStatus('running');
    jumpRef.current = true;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9b982);
    const camera = new THREE.OrthographicCamera(-9, 9, 5.25, -5.25, 0.1, 100);
    camera.position.set(0, 3.5, 25);
    camera.lookAt(0, 2.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Трёхмерная трасса динозаврика');
    host.appendChild(renderer.domElement);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const geo = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value; };
    const mat = (color: number, roughness = 0.86) => {
      const value = new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
      materials.add(value);
      return value;
    };
    const mesh = (geometry: THREE.BufferGeometry, color: number, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const item = new THREE.Mesh(geometry, mat(color));
      item.position.set(x, y, z);
      item.castShadow = true;
      item.receiveShadow = true;
      parent.add(item);
      return item;
    };

    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x765248, 1.8));
    const sunLight = new THREE.DirectionalLight(0xfff5de, 3.1);
    sunLight.position.set(-5, 12, 9);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffb58b, 0.35));

    const skyDisc = mesh(geo(new THREE.IcosahedronGeometry(1.2, 0)), 0xffcf6b, scene, 6.7, 4.2, -4);
    skyDisc.scale.setScalar(1.45);

    const distantMountains: THREE.Mesh[] = [];
    for (let index = 0; index < 7; index += 1) {
      const mountain = mesh(geo(new THREE.ConeGeometry(2.3 + Math.random(), 3.6 + Math.random() * 1.2, 5)), index % 2 ? 0xd99a70 : 0xe2ab7b, scene, -10 + index * 4.2, 0.6 + Math.random() * 0.3, -2.6);
      mountain.rotation.z = (Math.random() - 0.5) * 0.13;
      distantMountains.push(mountain);
    }

    const ground = mesh(geo(new THREE.BoxGeometry(100, 0.48, 6)), 0x73554b, scene, 0, -0.26, 0);
    ground.receiveShadow = true;
    mesh(geo(new THREE.BoxGeometry(100, 0.11, 6.1)), 0xf2c37b, scene, 0, 0.04, 0.12);

    const trackMarks = Array.from({ length: 12 }, (_, index) => mesh(
      geo(new THREE.BoxGeometry(0.82 + (index % 3) * 0.36, 0.07, 0.09)),
      0x634b45,
      scene,
      -8 + index * 1.7,
      0.13,
      1.4,
    ));

    const cloudMat = mat(0xffe3b8);
    const clouds = Array.from({ length: 5 }, (_, index) => {
      const group = new THREE.Group();
      const cloudGeometry = geo(new THREE.DodecahedronGeometry(0.36 + Math.random() * 0.18, 0));
      [-0.48, 0, 0.48].forEach((offset, part) => {
        const puff = new THREE.Mesh(cloudGeometry, cloudMat);
        puff.position.set(offset, part === 1 ? 0.12 : 0, 0);
        puff.scale.set(1.25, 0.86, 0.6);
        group.add(puff);
      });
      group.position.set(-9 + index * 5.2, 3 + (index % 3) * 0.63, -3.4);
      scene.add(group);
      return group;
    });

    const dino = new THREE.Group();
    scene.add(dino);
    mesh(geo(new THREE.BoxGeometry(1.6, 0.88, 0.8)), 0x4e7959, dino, 0, 0.95, 0);
    mesh(geo(new THREE.BoxGeometry(0.92, 0.78, 0.76)), 0x60915f, dino, 0.78, 1.5, 0);
    mesh(geo(new THREE.BoxGeometry(0.55, 0.36, 0.7)), 0x6fa467, dino, 1.45, 1.34, 0);
    mesh(geo(new THREE.BoxGeometry(0.19, 0.17, 0.13)), 0xfff5d8, dino, 0.97, 1.68, 0.4);
    mesh(geo(new THREE.BoxGeometry(0.1, 0.11, 0.08)), 0x263943, dino, 1.02, 1.69, 0.49);
    const tail = mesh(geo(new THREE.ConeGeometry(0.48, 1.25, 4)), 0x416d53, dino, -1.02, 0.97, -0.03);
    tail.rotation.z = Math.PI / 2;
    const legs = [0, 1].map((index) => mesh(geo(new THREE.BoxGeometry(0.28, 0.67, 0.32)), 0x355e4a, dino, index ? 0.58 : -0.1, 0.37, index ? -0.15 : 0.2));
    const feet = legs.map((leg) => mesh(geo(new THREE.BoxGeometry(0.43, 0.16, 0.4)), 0x273f3e, dino, leg.position.x + 0.04, 0.08, leg.position.z + 0.06));

    const createObstacle = (kind: ObstacleKind): THREE.Group => {
      const group = new THREE.Group();
      if (kind === 'cactus') {
        const cactusColor = Math.random() > 0.5 ? 0x4b8254 : 0x5d945a;
        mesh(geo(new THREE.BoxGeometry(0.35, 1.65, 0.38)), cactusColor, group, 0, 0.82, 0);
        mesh(geo(new THREE.BoxGeometry(0.29, 0.62, 0.32)), cactusColor, group, -0.35, 0.7, 0);
        mesh(geo(new THREE.BoxGeometry(0.31, 0.55, 0.33)), cactusColor, group, 0.31, 1.04, 0);
        mesh(geo(new THREE.BoxGeometry(0.37, 0.17, 0.35)), cactusColor, group, -0.19, 1.0, 0);
        mesh(geo(new THREE.BoxGeometry(0.34, 0.16, 0.33)), cactusColor, group, 0.15, 1.3, 0);
      } else if (kind === 'rock') {
        const rock = mesh(geo(new THREE.DodecahedronGeometry(0.67, 0)), 0x826253, group, 0, 0.49, 0);
        rock.scale.set(1.25, 0.78, 0.88);
      } else {
        const bird = new THREE.Group();
        mesh(geo(new THREE.IcosahedronGeometry(0.43, 0)), 0x524949, bird, 0, 0, 0);
        mesh(geo(new THREE.ConeGeometry(0.18, 0.45, 3)), 0xe78355, bird, 0.43, -0.06, 0.02).rotation.z = -Math.PI / 2;
        const wingL = mesh(geo(new THREE.BoxGeometry(0.75, 0.12, 0.42)), 0x74625c, bird, -0.1, 0.19, 0.14);
        const wingR = mesh(geo(new THREE.BoxGeometry(0.75, 0.12, 0.42)), 0x887166, bird, -0.1, 0.19, -0.14);
        wingL.rotation.z = -0.16;
        wingR.rotation.z = 0.16;
        group.add(bird);
        group.userData.bird = bird;
        group.userData.wings = [wingL, wingR];
      }
      scene.add(group);
      return group;
    };

    let nextObstacleX = 28;
    const obstacles: Obstacle[] = Array.from({ length: 4 }, (_, index) => {
      const kind: ObstacleKind = (['cactus', 'bird', 'rock'] as const)[index % 3];
      const group = createObstacle(kind);
      const width = OBSTACLE_WIDTHS[kind];
      const gap = INITIAL_SPEED * 1.2 + 5 + Math.random() * 3;
      group.position.set(nextObstacleX, kind === 'bird' ? 2.25 : 0.13, 0.7);
      nextObstacleX += width + gap;
      return { group, kind, width, gap };
    });

    const disposeObstacle = (group: THREE.Group) => {
      scene.remove(group);
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (geometries.delete(object.geometry)) object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((value) => {
            if (materials.delete(value)) value.dispose();
          });
        } else if (materials.delete(object.material)) {
          object.material.dispose();
        }
      });
    };

    let viewWidth = 18;
    let playerX = -5.2;
    let jumpY = 0;
    let jumpVelocity = 0;
    let elapsed = 0;
    let animationTime = 0;
    let score = 0;
    let hudElapsed = 0;
    let frame = 0;

    const reset = () => {
      jumpY = 0;
      jumpVelocity = 0;
      score = 0;
      animationTime = 0;
      let nextObstacleX = viewWidth * 0.56 + 36;
      obstacles.forEach((obstacle, index) => {
        obstacle.kind = (['cactus', 'bird', 'rock'] as const)[index % 3];
        obstacle.width = OBSTACLE_WIDTHS[obstacle.kind];
        obstacle.gap = INITIAL_SPEED * 1.2 + 5 + Math.random() * 3;
        disposeObstacle(obstacle.group);
        obstacle.group = createObstacle(obstacle.kind);
        obstacle.group.position.set(nextObstacleX, obstacle.kind === 'bird' ? 2.3 : 0.13, 0.7);
        nextObstacleX += obstacle.width + obstacle.gap;
      });
      dino.position.set(playerX, 0, 0);
      setScore(0);
    };
    resetRef.current = reset;

    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault();
      if (event.code === 'Space' || event.key === 'ArrowUp') {
        if (statusRef.current !== 'running') startRun();
        else if (jumpY === 0) jumpRef.current = true;
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        duckRef.current = true;
        setDucking(true);
      }
      if (event.key === 'Enter' && statusRef.current !== 'running') startRun();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        duckRef.current = false;
        setDucking(false);
      }
    };
    const releaseControls = () => {
      jumpRef.current = false;
      duckRef.current = false;
      setDucking(false);
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', releaseControls);
    document.addEventListener('visibilitychange', releaseControls);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      const viewHeight = width < 580 ? 8.8 : 9.4;
      const aspect = width / height;
      viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      playerX = -viewWidth * 0.31;
      dino.position.x = playerX;
      camera.position.x = playerX + viewWidth * 0.17;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const render = (now: number) => {
      const dt = Math.min(0.04, Math.max(0, (now - elapsed) / 1000));
      elapsed = now;
      animationTime += dt;
      if (statusRef.current === 'running') {
        if (jumpRef.current && jumpY === 0) {
          jumpVelocity = 12.1;
          jumpY = 0.02;
        }
        jumpRef.current = false;
        jumpY += jumpVelocity * dt;
        jumpVelocity -= 31 * dt;
        if (jumpY < 0) {
          jumpY = 0;
          jumpVelocity = 0;
        }

        const speed = Math.min(15, 8.1 + score / 180);
        score += dt * 13;
        dino.position.set(playerX, jumpY, 0);
        dino.scale.y = duckRef.current ? 0.58 : 1;
        legs.forEach((leg, index) => { leg.rotation.z = Math.sin(animationTime * 15 + index * Math.PI) * 0.45; });
        feet.forEach((foot, index) => { foot.position.y = 0.08 + Math.max(0, Math.sin(animationTime * 15 + index * Math.PI)) * 0.09; });

        for (const obstacle of obstacles) {
          obstacle.group.position.x -= speed * dt;
          if (obstacle.kind === 'bird') {
            const wings = obstacle.group.userData.wings as THREE.Mesh[] | undefined;
            wings?.forEach((wing, index) => { wing.rotation.z = Math.sin(animationTime * 10 + index * Math.PI) * 0.5; });
          }
          if (obstacle.group.position.x < playerX + 0.85 && obstacle.group.position.x > playerX - 0.85) {
            const hit = obstacle.kind === 'bird'
              ? !duckRef.current && jumpY < 1.4
              : jumpY < (obstacle.kind === 'cactus' ? 1.45 : 0.75);
            if (hit) {
              changeStatus('over');
              setScore(Math.floor(score));
              break;
            }
          }
          if (obstacle.group.position.x < -viewWidth * 0.65) {
            const tail = obstacles.reduce((furthest, candidate) => (
              candidate.group.position.x + candidate.width > furthest.group.position.x + furthest.width ? candidate : furthest
            ), obstacles[0]);
            const availableKinds = (['cactus', 'bird', 'rock'] as const).filter((kind) => kind !== tail.kind);
            obstacle.kind = availableKinds[Math.floor(Math.random() * availableKinds.length)];
            const spawnGap = Math.max(tail.gap, speed * 1.2 + 5) + Math.random() * 3;
            const spawnX = tail.group.position.x + tail.width + spawnGap;
            obstacle.width = OBSTACLE_WIDTHS[obstacle.kind];
            obstacle.gap = speed * 1.2 + 5 + Math.random() * 3;
            disposeObstacle(obstacle.group);
            obstacle.group = createObstacle(obstacle.kind);
            obstacle.group.position.set(spawnX, obstacle.kind === 'bird' ? 2.2 : 0.13, 0.7);
          }
        }

        trackMarks.forEach((mark) => {
          mark.position.x -= speed * dt;
          if (mark.position.x < -viewWidth / 2 - 1) mark.position.x = viewWidth / 2 + Math.random() * 1.8;
        });
        hudElapsed += dt;
        if (hudElapsed > 0.1) {
          hudElapsed = 0;
          setScore(Math.floor(score));
        }
      } else {
        dino.position.y = Math.sin(animationTime * 1.4) * 0.035;
      }

      clouds.forEach((cloud, index) => {
        cloud.position.x -= dt * (0.3 + index * 0.04);
        if (cloud.position.x < -viewWidth / 2 - 2) cloud.position.x = viewWidth / 2 + 2;
      });
      distantMountains.forEach((mountain, index) => { mountain.position.x += Math.sin(animationTime * 0.12 + index) * 0.0008; });
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', releaseControls);
      document.removeEventListener('visibilitychange', releaseControls);
      resetRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && !geometries.has(object.geometry)) object.geometry.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const message = status === 'over'
    ? 'Столкновение. Нажми, чтобы начать новый забег.'
    : status === 'ready'
      ? 'Пустыня ждёт. Выбери действие и стартуй.'
      : 'Кактус — перепрыгни. Птица — пригнись.';

  const setDuckingNow = (value: boolean) => {
    duckRef.current = value;
    setDucking(value);
  };

  return (
    <div className="game-controls-area dino-controls-area">
      <div className="dino-stage" ref={hostRef}>
        <div className="dino-hud"><span>ДИСТАНЦИЯ</span><b>{String(score).padStart(4, '0')}</b></div>
        {status !== 'running' && (
          <div className="dino-overlay">
            <div className="dino-overlay-card">
              <span>{status === 'over' ? 'ЗАБЕГ ЗАВЕРШЁН' : 'ПУСТЫНЯ ЗОВЁТ'}</span>
              <h2>{status === 'over' ? `${score} метров` : 'Готов к старту?'}</h2>
              <p>{message}</p>
              <button className="button button-coral" onClick={startRun}>{status === 'over' ? 'Начать заново' : 'Начать забег'} <span aria-hidden="true">↗</span></button>
            </div>
          </div>
        )}
      </div>
      <div className="dino-controls">
        <p className="dino-message" role="status">{message}</p>
        <div className="dino-action-buttons">
          <button className="button button-dark duck-button" aria-pressed={ducking}
            onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDuckingNow(true); }}
            onPointerUp={() => setDuckingNow(false)} onPointerCancel={() => setDuckingNow(false)}>
            ↓ Пригнуться
          </button>
          <button className="button button-coral jump-button" onClick={startRun}>↑ Прыжок</button>
        </div>
      </div>
    </div>
  );
}
