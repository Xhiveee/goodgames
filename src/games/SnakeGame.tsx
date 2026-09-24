import { useEffect, useState } from 'react';

const SIZE = 20;

interface Point {
  x: number;
  y: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';
type SnakeStatus = 'ready' | 'playing' | 'paused' | 'over' | 'won';

interface SnakeState {
  body: Point[];
  food: Point;
  direction: Direction;
  nextDirection: Direction;
  status: SnakeStatus;
  score: number;
}

function randomFood(body: Point[]): Point {
  let food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
  while (body.some((segment) => segment.x === food.x && segment.y === food.y)) {
    food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
  }
  return food;
}

function newGame(): SnakeState {
  const body = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
  return { body, food: randomFood(body), direction: 'right', nextDirection: 'right', status: 'ready', score: 0 };
}

const opposites: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const keyDirections: Record<string, Direction> = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
};

export default function SnakeGame() {
  const [game, setGame] = useState<SnakeState>(newGame);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const speed = Math.max(72, 155 - Math.floor(game.score / 4) * 9);
    const timer = window.setInterval(() => {
      setGame((current) => {
        const direction = current.nextDirection;
        const head = { ...current.body[0] };
        if (direction === 'up') head.y -= 1;
        if (direction === 'down') head.y += 1;
        if (direction === 'left') head.x -= 1;
        if (direction === 'right') head.x += 1;

        const growing = head.x === current.food.x && head.y === current.food.y;
        const bodyWithoutTail = current.body.slice(0, growing ? current.body.length : current.body.length - 1);
        const hitWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
        const hitBody = bodyWithoutTail.some((segment) => segment.x === head.x && segment.y === head.y);
        if (hitWall || hitBody) return { ...current, status: 'over' };

        const body = [head, ...bodyWithoutTail];
        if (growing && body.length === SIZE * SIZE) return { ...current, body, status: 'won', score: current.score + 1 };
        return {
          ...current,
          body,
          direction,
          food: growing ? randomFood(body) : current.food,
          score: current.score + (growing ? 1 : 0),
        };
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [game.status, Math.floor(game.score / 4)]);

  const steer = (direction: Direction) => {
    setGame((current) => {
      if (opposites[current.direction] === direction || opposites[current.nextDirection] === direction) return current;
      const status = current.status === 'ready' || current.status === 'paused' ? 'playing' : current.status;
      return { ...current, nextDirection: direction, status };
    });
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const direction = keyDirections[event.key];
      if (direction) {
        event.preventDefault();
        steer(direction);
      } else if (event.code === 'Space' && game.status !== 'playing') {
        event.preventDefault();
        setGame({ ...newGame(), status: 'playing' });
      } else if (event.key === 'Escape' && game.status === 'playing') {
        setGame((current) => ({ ...current, status: 'paused' }));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [game.status]);

  const statusMessage = game.status === 'won'
    ? 'Поле заполнено. Это было красиво.'
    : game.status === 'over'
      ? 'Змейка уткнулась не туда. Новая попытка?'
      : game.status === 'paused'
        ? 'Пауза. Выдохни и продолжай.'
      : game.status === 'ready'
        ? 'Выбери направление или нажми старт.'
        : 'Собирай ягоды. После каждых четырёх змейка ускоряется.';

  const bodySet = new Set(game.body.map((segment) => `${segment.x}:${segment.y}`));
  const headKey = `${game.body[0].x}:${game.body[0].y}`;
  const foodKey = `${game.food.x}:${game.food.y}`;

  return (
    <div className="game-controls-area snake-controls-area">
      <div className="snake-game-heading">
        <div><p className="game-eyebrow">АРКАДА · 20×20</p><h2>Змейка ищет ягоды</h2></div>
        <div className="snake-score">СЪЕДЕНО <b>{String(game.score).padStart(2, '0')}</b></div>
      </div>
      <div className="snake-toolbar">
        <p className="game-live-message" role="status">{statusMessage}</p>
        <span className="snake-speed-label">Скорость {Math.min(10, 1 + Math.floor(game.score / 4))}/10</span>
      </div>
      <div className="snake-board" role="group" aria-label={`Поле змейки. Яблок съедено: ${game.score}`}>
        {Array.from({ length: SIZE * SIZE }, (_, index) => {
          const x = index % SIZE;
          const y = Math.floor(index / SIZE);
          const key = `${x}:${y}`;
          const isHead = key === headKey;
          const isBody = bodySet.has(key) && !isHead;
          const isFood = key === foodKey;
          return (
            <div key={key} aria-hidden="true" className={`snake-cell${isHead ? ' is-head' : isBody ? ' is-body' : isFood ? ' is-food' : ''}`}>
              {isFood && <span aria-hidden="true" />}
            </div>
          );
        })}
        {game.status !== 'playing' && (
          <button className="snake-overlay" onClick={() => setGame((current) => current.status === 'paused' ? { ...current, status: 'playing' } : { ...newGame(), status: 'playing' })}>
            <b>{game.status === 'over' ? 'СТЕНА БЛИЖЕ' : game.status === 'won' ? 'ПОБЕДА' : game.status === 'paused' ? 'ПАУЗА' : 'ПОЕХАЛИ?'}</b>
            <span>{game.status === 'ready' ? 'Нажми, чтобы запустить' : game.status === 'paused' ? 'Коснись, чтобы продолжить' : 'Новая попытка'}</span>
          </button>
        )}
      </div>
      <div className="snake-footer">
        <div className="snake-pad" aria-label="Управление змейкой">
          <button className="pad-up" aria-label="Вверх" onClick={() => steer('up')}>↑</button>
          <button aria-label="Влево" onClick={() => steer('left')}>←</button>
          <button aria-label="Вниз" onClick={() => steer('down')}>↓</button>
          <button aria-label="Вправо" onClick={() => steer('right')}>→</button>
        </div>
        <div className="snake-actions">
          {game.status === 'playing' && <button className="button button-soft" onClick={() => setGame((current) => ({ ...current, status: 'paused' }))}>Пауза</button>}
          <button className="button button-dark" onClick={() => setGame({ ...newGame(), status: 'playing' })}>Новая игра</button>
        </div>
      </div>
    </div>
  );
}
