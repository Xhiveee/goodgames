import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Status = 'ready' | 'running' | 'over';
type Mode = 'choose' | 'offline' | 'online';
type OnlineStatus = 'idle' | 'connecting' | 'connected' | 'full' | 'error' | 'disconnected';

interface Point {
  x: number;
  z: number;
}

interface Worm {
  name: string;
  x: number;
  z: number;
  angle: number;
  targetAngle: number;
  length: number;
  score: number;
  speed: number;
  path: Point[];
  head: THREE.Group;
  body: THREE.Mesh[];
  alive: boolean;
  thinkTime: number;
  respawnTime: number;
  bot: boolean;
}

interface Pellet {
  mesh: THREE.Mesh;
  value: number;
}

interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  player: Worm;
  bots: Worm[];
  remotePlayers: Map<string, Worm>;
  pellets: Pellet[];
  keys: Set<string>;
  aim: number;
  pointerActive: boolean;
  reset: () => void;
  setOnlineMode: (online: boolean) => void;
  updateRemote: (player: SyncedPlayer, reset?: boolean) => void;
  removeRemote: (id: string) => void;
  setPellets: (positions: Array<Point & { index?: number }>, replace?: boolean) => void;
}

interface Hud {
  score: number;
  length: number;
  rivals: number;
  x: number;
  z: number;
}

interface SyncedPlayer {
  id: string;
  name: string;
  color: number;
  x: number;
  z: number;
  angle: number;
  length: number;
  score: number;
  alive: boolean;
}

interface ServerMessage {
  type: 'welcome' | 'join' | 'state' | 'leave' | 'full' | 'error';
  you?: SyncedPlayer;
  player?: SyncedPlayer;
  players?: SyncedPlayer[];
  pellets?: Array<Point & { index?: number }>;
  id?: string;
  capacity?: number;
  reset?: boolean;
  code?: string;
}

const ARENA_RADIUS = 58;
const BODY_LIMIT = 60;
const SEGMENT_GAP = 0.43;
const PELLET_COUNT = 96;
const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,5}$/u;
const FOOD_COLORS = [0xf7d566, 0xfa9175, 0x83d9a4, 0x91a6f0, 0xe8a5d0];
const PLAYER_COLORS = [0x9be364, 0x71cf67, 0x58b885, 0xc1e982];
const RIVAL_PALETTES = [
  [0xfa8a6b, 0xe86d65, 0xffb07f],
  [0xa28ced, 0x8069d0, 0xc1a7f7],
  [0x64cad0, 0x42aab6, 0x9be8dc],
];
const BOT_COUNT = 19;
const BOT_SPAWNS: Point[] = Array.from({ length: BOT_COUNT }, (_, index) => {
  const angle = (index / BOT_COUNT) * Math.PI * 2;
  const radius = 24 + (index % 3) * 4;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
});
const BOT_ANGLES = BOT_SPAWNS.map((point, index) => Math.atan2(point.z, point.x) + Math.PI / 2 + (index % 2 ? 0.35 : -0.35));
const MAP_COLORS = ['#fa8a6b', '#a28ced', '#64cad0', '#f7d566', '#88d2b1'];

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

function wrapAngle(angle: number) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function randomPoint(radius = ARENA_RADIUS - 6): Point {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

function pointAt(path: Point[], wantedDistance: number): Point {
  let walked = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index];
    const b = path[index + 1];
    const step = distance(a, b);
    if (walked + step >= wantedDistance) {
      const progress = step === 0 ? 0 : (wantedDistance - walked) / step;
      return { x: THREE.MathUtils.lerp(a.x, b.x, progress), z: THREE.MathUtils.lerp(a.z, b.z, progress) };
    }
    walked += step;
  }
  return path[path.length - 1] ?? { x: 0, z: 0 };
}

function setLength(worm: Worm, length: number) {
  worm.length = Math.min(BODY_LIMIT, Math.max(8, length));
  worm.body.forEach((segment, index) => { segment.visible = index < worm.length; });
}

function placeWorm(worm: Worm, x: number, z: number, angle: number, length: number) {
  worm.x = x;
  worm.z = z;
  worm.angle = angle;
  worm.targetAngle = angle;
  worm.alive = true;
  worm.thinkTime = 0.6 + Math.random();
  worm.respawnTime = 0;
  setLength(worm, length);
  worm.path = Array.from({ length: 220 }, (_, index) => ({
    x: x - Math.cos(angle) * index * 0.085,
    z: z - Math.sin(angle) * index * 0.085,
  }));
  worm.head.visible = true;
  worm.head.position.set(x, 0.72, z);
  worm.head.rotation.y = -angle;
  drawBody(worm);
}

function createWorm(
  scene: THREE.Scene,
  sphere: THREE.BufferGeometry,
  headGeometry: THREE.BufferGeometry,
  eyeGeometry: THREE.BufferGeometry,
  name: string,
  palette: number[],
  bot: boolean,
  trackMaterial: (value: THREE.Material) => THREE.Material,
): Worm {
  const makeMat = (color: number, roughness = 0.48) => trackMaterial(new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }));
  const head = new THREE.Group();
  const shell = new THREE.Mesh(headGeometry, makeMat(palette[0]));
  shell.scale.set(0.78, 0.76, 0.72);
  shell.castShadow = true;
  head.add(shell);

  const eyeWhite = makeMat(0xfff9e6, 0.25);
  const pupilMat = makeMat(0x233840, 0.22);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeometry, eyeWhite);
    eye.position.set(0.27, 0.25, side * 0.32);
    eye.scale.set(0.2, 0.2, 0.2);
    head.add(eye);
    const pupil = new THREE.Mesh(eyeGeometry, pupilMat);
    pupil.position.set(0.42, 0.25, side * 0.32);
    pupil.scale.set(0.085, 0.1, 0.1);
    head.add(pupil);
  });
  scene.add(head);

  const body = Array.from({ length: BODY_LIMIT }, (_, index) => {
    const segment = new THREE.Mesh(sphere, makeMat(palette[(index + 1) % palette.length]));
    segment.scale.set(0.56, 0.48, 0.56);
    segment.castShadow = true;
    segment.receiveShadow = true;
    scene.add(segment);
    return segment;
  });

  return {
    name,
    x: 0,
    z: 0,
    angle: 0,
    targetAngle: 0,
    length: 14,
    score: 0,
    speed: bot ? 3.6 : 5,
    path: [] as Point[],
    head,
    body,
    alive: true,
    thinkTime: 1,
    respawnTime: 0,
    bot,
  };
}

function drawBody(worm: Worm) {
  worm.head.position.set(worm.x, 0.72, worm.z);
  worm.head.rotation.y = -worm.angle;
  worm.body.forEach((segment, index) => {
    if (index >= worm.length) return;
    const point = pointAt(worm.path, (index + 1) * SEGMENT_GAP);
    segment.position.set(point.x, 0.48 + Math.sin(index * 0.3) * 0.035, point.z);
  });
}

export default function SlitherGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const statusRef = useRef<Status>('ready');
  const modeRef = useRef<Mode>('choose');
  const onlineStatusRef = useRef<OnlineStatus>('idle');
  const boostRef = useRef(false);
  const [status, setStatus] = useState<Status>('ready');
  const [mode, setMode] = useState<Mode>('choose');
  const [onlineStatus, setOnlineStatusState] = useState<OnlineStatus>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [nickname, setNickname] = useState('');
  const [hud, setHud] = useState<Hud>({ score: 0, length: 14, rivals: BOT_COUNT, x: 0, z: 0 });
  const [boosting, setBoostingState] = useState(false);

  const updateMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };

  const updateOnlineStatus = (next: OnlineStatus) => {
    onlineStatusRef.current = next;
    setOnlineStatusState(next);
  };

  const changeStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const startOfflineGame = () => {
    const socket = socketRef.current;
    socketRef.current = null;
    playerIdRef.current = null;
    socket?.close();
    updateMode('offline');
    updateOnlineStatus('idle');
    setConnectionError('');
    worldRef.current?.setOnlineMode(false);
    worldRef.current?.reset();
    boostRef.current = false;
    setBoostingState(false);
    setHud({ score: 0, length: 14, rivals: BOT_COUNT, x: 0, z: 0 });
    changeStatus('running');
  };

  const connectOnline = () => {
    if (socketRef.current?.readyState === WebSocket.CONNECTING || socketRef.current?.readyState === WebSocket.OPEN) return;
    const normalizedNickname = nickname.normalize('NFKC');
    if (!NICKNAME_PATTERN.test(normalizedNickname)) {
      setConnectionError('Используй 2–5 букв или цифр.');
      return;
    }
    updateMode('online');
    updateOnlineStatus('connecting');
    setConnectionError('Подключаемся к серверу…');
    const configuredServerUrl = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SLITHER_SERVER_URL;
    const serverUrl = configuredServerUrl
      || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8787/slither`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(serverUrl);
    } catch {
      updateOnlineStatus('error');
      setConnectionError('Не удалось подключиться. Проверь адрес сервера.');
      return;
    }
    socketRef.current = socket;
    socket.onopen = () => {
      if (socketRef.current === socket) socket.send(JSON.stringify({ type: 'join', name: normalizedNickname }));
    };

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        updateOnlineStatus('error');
        setConnectionError('Сервер прислал неверный ответ.');
        if (statusRef.current === 'running') changeStatus('over');
        socket.close();
        return;
      }

      const world = worldRef.current;
      if (message.type === 'error') {
        if (message.code === 'nickname_invalid' || message.code === 'nickname_taken' || message.code === 'nickname_required') {
          socketRef.current = null;
          updateMode('choose');
          updateOnlineStatus('idle');
          setConnectionError(message.code === 'nickname_taken' ? 'Этот ник уже занят. Введи другой.' : 'Используй 2–5 букв или цифр.');
          socket.close();
          return;
        }
        updateOnlineStatus('error');
        setConnectionError('Сервер отклонил подключение. Попробуй снова.');
        socket.close();
        return;
      }
      if (message.type === 'full') {
        updateOnlineStatus('full');
        setConnectionError(`Арена заполнена: ${message.capacity ?? 20} игроков.`);
        setHud((current) => ({ ...current, rivals: Math.max(0, (message.capacity ?? 20) - 1) }));
        socket.close();
        return;
      }

      if (message.type === 'welcome' && message.you && world) {
        const you = message.you;
        playerIdRef.current = you.id;
        world.setOnlineMode(true);
        world.reset();
        placeWorm(world.player, you.x, you.z, you.angle, you.length);
        world.player.score = you.score;
        world.setPellets(message.pellets ?? [], true);
        (message.players ?? []).forEach((remote) => world.updateRemote(remote));
        setHud({ score: you.score, length: you.length, rivals: world.remotePlayers.size, x: you.x, z: you.z });
        updateOnlineStatus('connected');
        setConnectionError('');
        changeStatus('running');
        return;
      }

      if (message.type === 'leave' && message.id && world) {
        world.removeRemote(message.id);
        setHud((current) => ({ ...current, rivals: world.remotePlayers.size }));
        return;
      }

      if ((message.type === 'join' || message.type === 'state') && message.player && world) {
        const player = message.player;
        if (player.id === playerIdRef.current) {
          if (message.reset) {
            placeWorm(world.player, player.x, player.z, player.angle, player.length);
            world.player.score = player.score;
            changeStatus('running');
          } else {
            setLength(world.player, player.length);
            world.player.score = player.score;
          }
          setHud((current) => ({ ...current, score: player.score, length: player.length, rivals: world.remotePlayers.size }));
        } else {
          world.updateRemote(player, message.reset);
          setHud((current) => ({ ...current, rivals: world.remotePlayers.size }));
        }
        if (message.pellets?.length) world.setPellets(message.pellets);
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      updateOnlineStatus('error');
      setConnectionError('Нет соединения с сервером. Запусти игровой сервер и попробуй снова.');
      if (statusRef.current === 'running') changeStatus('over');
    };
    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (onlineStatusRef.current === 'full' || onlineStatusRef.current === 'error') return;
      updateOnlineStatus('disconnected');
      if (statusRef.current === 'running') {
        setConnectionError('Соединение потеряно. Переподключись, чтобы сыграть снова.');
        changeStatus('over');
      }
    };
  };

  const retryOnlineGame = () => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'respawn' }));
      return;
    }
    connectOnline();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x183542);
    const camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.1, 140);
    camera.up.set(0, 0, -1);
    camera.position.set(0, 42, 0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Поле игры Слизарио');
    host.appendChild(renderer.domElement);

    const resources = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const geometry = <T extends THREE.BufferGeometry>(value: T) => { resources.add(value); return value; };
    const material = <T extends THREE.Material>(value: T) => { materials.add(value); return value; };

    scene.add(new THREE.HemisphereLight(0xe9f5db, 0x315a58, 2.05));
    const sun = new THREE.DirectionalLight(0xfff6da, 3.4);
    sun.position.set(-12, 25, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x87cae0, 1.2);
    rim.position.set(14, 12, 18);
    scene.add(rim);

    const floor = new THREE.Mesh(
      geometry(new THREE.CircleGeometry(ARENA_RADIUS, 72)),
      material(new THREE.MeshStandardMaterial({ color: 0x315d57, roughness: 1, flatShading: true })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.16;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_RADIUS * 2, 28, 0x8bd3a6, 0x5a8c81);
    grid.position.y = -0.08;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.23;
    scene.add(grid);

    const arenaRing = new THREE.Mesh(
      geometry(new THREE.TorusGeometry(ARENA_RADIUS - 0.3, 0.22, 5, 140)),
      material(new THREE.MeshStandardMaterial({ color: 0xf7d566, emissive: 0x674b11, emissiveIntensity: 0.28, flatShading: true })),
    );
    arenaRing.rotation.x = -Math.PI / 2;
    arenaRing.position.y = 0.08;
    arenaRing.receiveShadow = true;
    scene.add(arenaRing);

    const propGeometry = geometry(new THREE.IcosahedronGeometry(1, 0));
    const propMaterials = [0x6f9d6b, 0x89b778, 0xb5c980].map((color) => material(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 })));
    for (let index = 0; index < 46; index += 1) {
      const angle = (index / 46) * Math.PI * 2;
      const radius = ARENA_RADIUS + 2.5 + Math.random() * 3.5;
      const rock = new THREE.Mesh(propGeometry, propMaterials[index % propMaterials.length]);
      rock.position.set(Math.cos(angle) * radius, 0.42 + Math.random() * 0.55, Math.sin(angle) * radius);
      rock.scale.set(0.55 + Math.random() * 0.9, 0.7 + Math.random() * 1.1, 0.55 + Math.random() * 0.9);
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.35);
      rock.castShadow = true;
      scene.add(rock);
    }

    const segmentGeometry = geometry(new THREE.SphereGeometry(0.52, 8, 6));
    const headGeometry = geometry(new THREE.IcosahedronGeometry(0.62, 0));
    const eyeGeometry = geometry(new THREE.SphereGeometry(0.5, 8, 6));
    const player = createWorm(scene, segmentGeometry, headGeometry, eyeGeometry, 'Ты', PLAYER_COLORS, false, material);
    placeWorm(player, 0, 0, 0.18, 14);
    const bots = Array.from({ length: BOT_COUNT }, (_, index) => {
      const palette = RIVAL_PALETTES[index % RIVAL_PALETTES.length];
      const bot = createWorm(scene, segmentGeometry, headGeometry, eyeGeometry, `Бот ${index + 1}`, palette, true, material);
      const spawn = BOT_SPAWNS[index];
      placeWorm(bot, spawn.x, spawn.z, BOT_ANGLES[index], 12 + index * 2);
      return bot;
    });

    const pelletGeometry = geometry(new THREE.DodecahedronGeometry(0.25, 0));
    const pelletMaterials = FOOD_COLORS.map((color) => material(new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      flatShading: true,
      roughness: 0.28,
    })));
    const pellets = Array.from({ length: PELLET_COUNT }, (_, index) => {
      const mesh = new THREE.Mesh(pelletGeometry, pelletMaterials[index % pelletMaterials.length]);
      const point = randomPoint();
      mesh.position.set(point.x, 0.35, point.z);
      mesh.scale.setScalar(0.65 + Math.random() * 1.05);
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      mesh.castShadow = true;
      scene.add(mesh);
      return { mesh, value: 1 };
    });

    const keys = new Set<string>();
    const remotePlayers = new Map<string, Worm>();
    let runningTime = 0;
    const removeRemote = (id: string) => {
      const worm = remotePlayers.get(id);
      if (!worm) return;
      scene.remove(worm.head);
      worm.body.forEach((segment) => scene.remove(segment));
      remotePlayers.delete(id);
    };
    const setOnlineMode = (online: boolean) => {
      bots.forEach((bot) => {
        bot.alive = !online;
        bot.head.visible = !online;
        bot.body.forEach((segment, index) => { segment.visible = !online && index < bot.length; });
      });
      [...remotePlayers.keys()].forEach(removeRemote);
    };
    const updateRemote = (synced: SyncedPlayer, reset = false) => {
      let worm = remotePlayers.get(synced.id);
      if (!worm) {
        worm = createWorm(scene, segmentGeometry, headGeometry, eyeGeometry, synced.name, RIVAL_PALETTES[synced.color % RIVAL_PALETTES.length], true, material);
        remotePlayers.set(synced.id, worm);
        reset = true;
      }
      if (reset) {
        placeWorm(worm, synced.x, synced.z, synced.angle, synced.length);
      } else {
        if (distance(worm, synced) > 0.045) {
          worm.path.unshift({ x: synced.x, z: synced.z });
          if (worm.path.length > 900) worm.path.pop();
        }
        worm.x = synced.x;
        worm.z = synced.z;
        worm.angle = synced.angle;
        setLength(worm, synced.length);
        drawBody(worm);
      }
      worm.score = synced.score;
      worm.alive = synced.alive;
      worm.head.visible = synced.alive;
      worm.body.forEach((segment, index) => { segment.visible = synced.alive && index < worm.length; });
    };
    const setPellets = (positions: Array<Point & { index?: number }>, replace = false) => {
      positions.forEach((point, positionIndex) => {
        const index = replace ? positionIndex : point.index;
        if (index === undefined || index < 0 || index >= pellets.length) return;
        pellets[index].mesh.position.set(point.x, 0.35, point.z);
        pellets[index].mesh.visible = true;
        pellets[index].mesh.material = pelletMaterials[index % pelletMaterials.length];
      });
    };
    const world: World = {
      renderer, scene, camera, player, bots, remotePlayers, pellets, keys,
      aim: player.angle, pointerActive: false, reset: () => undefined,
      setOnlineMode, updateRemote, removeRemote, setPellets,
    };
    world.reset = () => {
      placeWorm(player, 0, 0, 0.18, 14);
      player.score = 0;
      runningTime = 0;
      score = 0;
      hudElapsed = 0;
      boostElapsed = 0;
      bots.forEach((bot, index) => {
        const spawn = BOT_SPAWNS[index];
        placeWorm(bot, spawn.x, spawn.z, BOT_ANGLES[index], 12 + index * 2);
        bot.score = 0;
      });
      pellets.forEach(({ mesh }, index) => {
        const point = randomPoint();
        mesh.position.set(point.x, 0.35, point.z);
        mesh.visible = true;
        mesh.material = pelletMaterials[index % pelletMaterials.length];
      });
      world.aim = player.angle;
      world.pointerActive = false;
      world.setOnlineMode(modeRef.current === 'online');
    };
    worldRef.current = world;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const aimFromPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
      if (hit) {
        world.aim = Math.atan2(hit.z - player.z, hit.x - player.x);
        world.pointerActive = true;
      }
    };

    const keyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd', ' ', 'enter'].includes(key) || event.code === 'Space') event.preventDefault();
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) world.pointerActive = false;
      keys.add(key);
      if (event.code === 'Space') {
        boostRef.current = true;
        setBoostingState(true);
      }
      if (event.key === 'Enter' && statusRef.current !== 'running') {
        if (modeRef.current === 'online') retryOnlineGame();
        else startOfflineGame();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
      if (event.code === 'Space') {
        boostRef.current = false;
        setBoostingState(false);
      }
    };
    const releaseControls = () => {
      keys.clear();
      boostRef.current = false;
      setBoostingState(false);
    };
    renderer.domElement.addEventListener('pointermove', aimFromPointer);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', releaseControls);
    document.addEventListener('visibilitychange', releaseControls);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      const viewHeight = width < 600 ? 28.5 : 21;
      const aspect = width / height;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let score = 0;
    let elapsed = 0;
    let hudElapsed = 0;
    let boostElapsed = 0;
    let syncElapsed = 0;
    let frame = 0;
    const temp = new THREE.Vector3();
    const updateWorm = (worm: Worm, dt: number, boosting = false) => {
      const keyTurn = worm === player
        ? (keys.has('arrowleft') || keys.has('a') ? -1 : 0) + (keys.has('arrowright') || keys.has('d') ? 1 : 0)
        : 0;
      if (worm === player && keyTurn === 0 && world.pointerActive) worm.targetAngle = world.aim;
      if (keyTurn !== 0) worm.targetAngle += keyTurn * 2.5 * dt;
      const delta = wrapAngle(worm.targetAngle - worm.angle);
      worm.angle += THREE.MathUtils.clamp(delta, -2.25 * dt, 2.25 * dt);
      const speed = worm.bot ? worm.speed : boosting ? 8.6 : 5.2;
      worm.x += Math.cos(worm.angle) * speed * dt;
      worm.z += Math.sin(worm.angle) * speed * dt;
      if (distance(worm.path[0] ?? { x: worm.x, z: worm.z }, { x: worm.x, z: worm.z }) > 0.045) {
        worm.path.unshift({ x: worm.x, z: worm.z });
        if (worm.path.length > 900) worm.path.pop();
      }
      drawBody(worm);
    };

    const dropPellet = (point: Point) => {
      const pellet = pellets.find((item) => !item.mesh.visible) ?? pellets.reduce((nearest, item) => {
        const nearestDistance = distance({ x: nearest.mesh.position.x, z: nearest.mesh.position.z }, point);
        const itemDistance = distance({ x: item.mesh.position.x, z: item.mesh.position.z }, point);
        return itemDistance < nearestDistance ? item : nearest;
      }, pellets[0]);
      pellet.mesh.position.set(point.x, 0.35, point.z);
      pellet.mesh.visible = true;
    };

    const respawnPellet = (pellet: Pellet) => {
      const point = randomPoint();
      pellet.mesh.position.set(point.x, 0.35, point.z);
      pellet.mesh.material = pelletMaterials[Math.floor(Math.random() * pelletMaterials.length)];
      pellet.mesh.visible = true;
    };

    const collideWithBody = (worm: Worm, other: Worm, fromSegment = 3) => {
      for (let index = fromSegment; index < other.length; index += 2) {
        if (distance({ x: worm.x, z: worm.z }, pointAt(other.path, index * SEGMENT_GAP)) < 0.78) return true;
      }
      return false;
    };

    const render = (now: number) => {
      const dt = Math.min(0.04, Math.max(0, (now - elapsed) / 1000));
      elapsed = now;
      if (statusRef.current === 'running') {
        runningTime += dt;
        updateWorm(player, dt, boostRef.current);
        if (modeRef.current !== 'online') bots.forEach((bot) => {
          if (!bot.alive) {
            bot.respawnTime -= dt;
            if (bot.respawnTime <= 0) {
              const point = randomPoint(ARENA_RADIUS * 0.48);
              placeWorm(bot, point.x, point.z, Math.random() * Math.PI * 2, 12);
            }
            return;
          }
          bot.thinkTime -= dt;
          if (bot.thinkTime <= 0) {
            bot.thinkTime = 0.85 + Math.random() * 1.5;
            const edge = Math.hypot(bot.x, bot.z) > ARENA_RADIUS - 15;
            const nearest = pellets.reduce<{ point: Point; distance: number } | null>((best, pellet) => {
              if (!pellet.mesh.visible) return best;
              const point = { x: pellet.mesh.position.x, z: pellet.mesh.position.z };
              const d = distance({ x: bot.x, z: bot.z }, point);
              return d < (best?.distance ?? 14) ? { point, distance: d } : best;
            }, null);
            bot.targetAngle = edge
              ? Math.atan2(-bot.z, -bot.x)
              : nearest && Math.random() < 0.76
                ? Math.atan2(nearest.point.z - bot.z, nearest.point.x - bot.x)
                : bot.angle + (Math.random() - 0.5) * 2;
          }
          updateWorm(bot, dt);
        });

        for (const pellet of pellets) {
          if (!pellet.mesh.visible) continue;
          const point = { x: pellet.mesh.position.x, z: pellet.mesh.position.z };
          if (modeRef.current !== 'online' && distance({ x: player.x, z: player.z }, point) < 0.9) {
            score += pellet.value;
            player.score = score;
            setLength(player, player.length + 1);
            respawnPellet(pellet);
            continue;
          }
          if (modeRef.current === 'online') continue;
          for (const bot of bots) {
            if (bot.alive && distance({ x: bot.x, z: bot.z }, point) < 0.8) {
              bot.score += pellet.value;
              setLength(bot, bot.length + 1);
              respawnPellet(pellet);
              break;
            }
          }
        }

        if (boostRef.current) {
          boostElapsed += dt;
          if (boostElapsed > 1.25 && player.length > 9) {
            boostElapsed = 0;
            setLength(player, player.length - 1);
            const drop = { x: player.x - Math.cos(player.angle) * 1.1, z: player.z - Math.sin(player.angle) * 1.1 };
            if (modeRef.current === 'online') {
              socketRef.current?.send(JSON.stringify({ type: 'drop', ...drop }));
            } else {
              dropPellet(drop);
            }
          }
        } else {
          boostElapsed = 0;
        }

        const rivals = modeRef.current === 'online' ? [...world.remotePlayers.values()] : bots;
        const hitRival = rivals.some((rival) => rival.alive && collideWithBody(player, rival, 4));
        const hitWall = Math.hypot(player.x, player.z) > ARENA_RADIUS - 0.7;
        if (runningTime > 5 && (hitWall || hitRival)) {
          boostRef.current = false;
          setBoostingState(false);
          changeStatus('over');
        }

        if (modeRef.current !== 'online') bots.forEach((bot) => {
          if (!bot.alive) return;
          const hitPlayer = collideWithBody(bot, player, 4);
          const hitRival = bots.some((other) => other !== bot && other.alive && collideWithBody(bot, other, 4));
          if (hitPlayer || hitRival || Math.hypot(bot.x, bot.z) > ARENA_RADIUS - 0.7) {
            bot.alive = false;
            bot.head.visible = false;
            bot.body.forEach((segment) => { segment.visible = false; });
            bot.respawnTime = 3 + Math.random() * 2;
            for (let index = 2; index < bot.length; index += 4) {
              dropPellet(pointAt(bot.path, index * SEGMENT_GAP));
            }
          }
        });

        const lookAt = temp.set(player.x, 0, player.z);
        const cameraPosition = new THREE.Vector3(player.x, 42, player.z);
        camera.position.lerp(cameraPosition, 0.09);
        camera.lookAt(lookAt);
        hudElapsed += dt;
        if (hudElapsed > 0.12) {
          hudElapsed = 0;
          setHud((current) => ({
            score: modeRef.current === 'online' ? current.score : score,
            length: player.length,
            rivals: modeRef.current === 'online' ? world.remotePlayers.size : bots.filter((bot) => bot.alive).length,
            x: player.x,
            z: player.z,
          }));
        }
      }

      if (modeRef.current === 'online' && socketRef.current?.readyState === WebSocket.OPEN) {
        syncElapsed += dt;
        if (syncElapsed >= 0.05) {
          syncElapsed = 0;
          socketRef.current.send(JSON.stringify({
            type: 'state',
            x: player.x,
            z: player.z,
            angle: player.angle,
            alive: statusRef.current === 'running',
          }));
        }
      }

      pellets.forEach((pellet, index) => {
        if (pellet.mesh.visible) {
          pellet.mesh.rotation.y += dt * (0.8 + (index % 4) * 0.15);
          pellet.mesh.position.y = 0.34 + Math.sin(now / 360 + index) * 0.08;
        }
      });
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', aimFromPointer);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', releaseControls);
      document.removeEventListener('visibilitychange', releaseControls);
      socketRef.current?.close();
      socketRef.current = null;
      worldRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && !resources.has(object.geometry)) object.geometry.dispose();
      });
      grid.geometry.dispose();
      if (Array.isArray(grid.material)) grid.material.forEach((value) => value.dispose());
      else grid.material.dispose();
      resources.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const setBoosting = (value: boolean) => {
    boostRef.current = value;
    setBoostingState(value);
  };

  const setTurning = (direction: 'a' | 'd', active: boolean) => {
    const keys = worldRef.current?.keys;
    if (!keys) return;
    if (active) {
      const world = worldRef.current;
      if (world) world.pointerActive = false;
    }
    if (active) keys.add(direction);
    else keys.delete(direction);
  };

  const world = worldRef.current;
  const otherMapActors = mode === 'online'
    ? [...(world?.remotePlayers.entries() ?? [])]
      .filter(([, worm]) => worm.alive)
      .map(([id, worm], index) => ({ id, name: worm.name, score: worm.score, x: worm.x, z: worm.z, color: MAP_COLORS[index % MAP_COLORS.length] }))
    : (world?.bots ?? [])
      .filter((worm) => worm.alive)
      .map((worm, index) => ({ id: `bot-${index}`, name: worm.name, score: worm.score, x: worm.x, z: worm.z, color: MAP_COLORS[index % MAP_COLORS.length] }));
  otherMapActors.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  const mapActors = [
    { id: 'you', name: mode === 'online' ? nickname.trim() || 'Ты' : 'Ты', score: hud.score, x: hud.x, z: hud.z, color: '#e0f17d' },
    ...otherMapActors,
  ];

  const message = mode === 'online' && onlineStatus !== 'connected'
    ? connectionError
      : status === 'over'
        ? `Съедено частиц: ${hud.score}. Попробуй обогнать соперников ещё раз.`
      : mode === 'choose'
        ? connectionError || 'Выбери одиночную игру или общую арену до 20 игроков.'
        : 'Первые пять секунд защищены. Собирай частицы и выбирай путь.';

  return (
    <div className="game-controls-area slither-controls-area">
      <div className="slither-stage" ref={hostRef}>
        <div className="slither-hud slither-hud-left">
          <div className="slither-stat"><span>ЧАСТИЦЫ</span><b>{String(hud.score).padStart(2, '0')}</b></div>
          <div className="slither-stat"><span>ДЛИНА</span><b>{String(hud.length).padStart(2, '0')}</b></div>
        </div>
        <div className="slither-hud slither-hud-right">
          <span className="rival-dot" />
          <span>На арене</span>
          <b>{hud.rivals + 1}</b>
        </div>
        {otherMapActors.length > 0 && (
          <div className="slither-opponent-list" role="list" aria-label="Ники соперников">
            {otherMapActors.map((actor) => (
              <span key={`name-${actor.id}`} className="slither-opponent-name" role="listitem" title={actor.name}>
                <i style={{ backgroundColor: actor.color }} />
                <span className="slither-opponent-nick">{actor.name}</span>
                <b className="slither-opponent-score">{actor.score}</b>
              </span>
            ))}
          </div>
        )}
        <div className="slither-location" role="group" aria-label="Миникарта игроков и ботов">
          {mapActors.map((actor) => (
            <span key={actor.id} className={`slither-location-marker${actor.id === 'you' ? ' is-self' : ''}`}
              title={actor.name} aria-label={actor.name}
              style={{ left: `${Math.min(96, Math.max(4, 50 + (actor.x / ARENA_RADIUS) * 46))}%`, top: `${Math.min(96, Math.max(4, 50 + (actor.z / ARENA_RADIUS) * 46))}%`, backgroundColor: actor.color }} />
          ))}
        </div>
        {status !== 'running' && (
          <div className="slither-overlay">
            <div className="slither-overlay-card">
              {mode === 'choose' ? (
                <>
                  <span className="slither-overline">АРЕНА ЖДЁТ</span>
                  <h2>Собери свой путь</h2>
                  <p>{message}</p>
                  <label style={{ display: 'grid', gap: 7, marginBottom: 12, color: '#426164', fontSize: '0.83rem', fontWeight: 800, textAlign: 'left' }}>
                    Ник для онлайн-арены
                    <input type="text" aria-label="Ник для онлайн-арены" autoComplete="nickname" required maxLength={5}
                      value={nickname} onChange={(event) => setNickname(event.target.value.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 5))} placeholder="2–5 букв или цифр"
                      style={{ width: '100%', minHeight: 44, padding: '0 12px', border: '1px solid rgba(25, 56, 59, 0.18)', borderRadius: 12, background: '#fffdf4', color: 'var(--ink)', fontSize: '0.9rem', fontWeight: 700 }} />
                    <small style={{ fontSize: '0.68rem', fontWeight: 600 }}>Только буквы и цифры. Ник должен быть свободен.</small>
                  </label>
                  <div className="slither-mode-actions">
                    <button className="button button-soft" onClick={startOfflineGame}>Офлайн · боты</button>
                    <button className="button button-lime" disabled={!NICKNAME_PATTERN.test(nickname.normalize('NFKC'))} onClick={connectOnline}
                      style={{ opacity: NICKNAME_PATTERN.test(nickname.normalize('NFKC')) ? 1 : 0.55 }}>Онлайн · до 20</button>
                  </div>
                </>
              ) : mode === 'online' && onlineStatus !== 'connected' ? (
                <>
                  <span className="slither-overline">{onlineStatus === 'connecting' ? 'ПОДКЛЮЧЕНИЕ' : 'ОНЛАЙН-АРЕНА'}</span>
                  <h2>{onlineStatus === 'connecting' ? 'Ищем игроков' : onlineStatus === 'full' ? 'Арена заполнена' : 'Нет соединения'}</h2>
                  <p>{message}</p>
                  <div className="slither-mode-actions">
                    {onlineStatus !== 'connecting' && <button className="button button-lime" onClick={connectOnline}>Попробовать снова</button>}
                    <button className="button button-soft" onClick={startOfflineGame}>Играть офлайн</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="slither-overline">{status === 'over' ? 'КОНЕЦ ЗАБЕГА' : 'АРЕНА ЖДЁТ'}</span>
                  <h2>{status === 'over' ? `Длина ${hud.length}` : 'Собери свой путь'}</h2>
                  <p>{message}</p>
                  <button className="button button-lime" onClick={mode === 'online' ? retryOnlineGame : startOfflineGame}>
                    {status === 'over' ? 'Войти снова' : 'Начать игру'} <span aria-hidden="true">↗</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="slither-controls">
        <div className="slither-tip"><span className="slither-tip-mark">✦</span><p>Веди мышь или палец. На телефоне поворачивай стрелками. Ускоряйся на прямой.</p></div>
        <div className="slither-turn-pad" aria-label="Поворот змейки">
          <button aria-label="Повернуть влево" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTurning('a', true); }}
            onPointerUp={() => setTurning('a', false)} onPointerCancel={() => setTurning('a', false)}>↶</button>
          <button aria-label="Повернуть вправо" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTurning('d', true); }}
            onPointerUp={() => setTurning('d', false)} onPointerCancel={() => setTurning('d', false)}>↷</button>
        </div>
        <button className={`boost-button${boosting ? ' is-boosting' : ''}`} aria-label="Зажми для ускорения"
          onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setBoosting(true); }}
          onPointerUp={() => setBoosting(false)} onPointerCancel={() => setBoosting(false)}
          onContextMenu={(event) => event.preventDefault()}>
          <span className="boost-icon" aria-hidden="true">ϟ</span><span>Ускорение</span><small>съедает длину</small>
        </button>
      </div>
    </div>
  );
}
