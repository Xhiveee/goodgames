import { useEffect, useState } from 'react';

type Difficulty = 'calm' | 'steady' | 'expert';
type Status = 'ready' | 'playing' | 'won' | 'lost';

interface Cell {
  mine: boolean;
  count: number;
  revealed: boolean;
  flagged: boolean;
}

const LEVELS: Record<Difficulty, { label: string; size: number; mines: number }> = {
  calm: { label: 'Спокойно · 10×10', size: 10, mines: 12 },
  steady: { label: 'Обычно · 12×12', size: 12, mines: 22 },
  expert: { label: 'Сложно · 14×14', size: 14, mines: 38 },
};

function neighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const column = index % size;
  const result: number[] = [];
  for (let y = Math.max(0, row - 1); y <= Math.min(size - 1, row + 1); y += 1) {
    for (let x = Math.max(0, column - 1); x <= Math.min(size - 1, column + 1); x += 1) {
      const next = y * size + x;
      if (next !== index) result.push(next);
    }
  }
  return result;
}

function createBoard(size: number, mineCount: number, safeCell = -1): Cell[] {
  const cells = Array.from({ length: size * size }, () => ({ mine: false, count: 0, revealed: false, flagged: false }));
  const protectedCells = new Set(safeCell < 0 ? [] : [safeCell, ...neighbors(safeCell, size)]);
  const available = cells.map((_, index) => index).filter((index) => !protectedCells.has(index));

  for (let index = 0; index < mineCount; index += 1) {
    const choice = Math.floor(Math.random() * available.length);
    cells[available.splice(choice, 1)[0]].mine = true;
  }

  cells.forEach((cell, index) => {
    if (!cell.mine) cell.count = neighbors(index, size).filter((neighbor) => cells[neighbor].mine).length;
  });
  return cells;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function MinesweeperGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('calm');
  const [board, setBoard] = useState(() => createBoard(LEVELS.calm.size, LEVELS.calm.mines));
  const [status, setStatus] = useState<Status>('ready');
  const [flagMode, setFlagMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const level = LEVELS[difficulty];

  useEffect(() => {
    if (status !== 'playing') return;
    const timer = window.setInterval(() => setSeconds((time) => time + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const restart = (nextDifficulty = difficulty) => {
    const nextLevel = LEVELS[nextDifficulty];
    setDifficulty(nextDifficulty);
    setBoard(createBoard(nextLevel.size, nextLevel.mines));
    setStatus('ready');
    setFlagMode(false);
    setSeconds(0);
  };

  const toggleFlag = (index: number) => {
    if (status === 'won' || status === 'lost' || board[index].revealed) return;
    const next = board.map((cell) => ({ ...cell }));
    next[index].flagged = !next[index].flagged;
    setBoard(next);
  };

  const reveal = (index: number) => {
    if (status === 'won' || status === 'lost' || board[index].flagged || board[index].revealed) return;
    if (flagMode) {
      toggleFlag(index);
      return;
    }

    let next = board.map((cell) => ({ ...cell }));
    if (status === 'ready') {
      const flags = next.map((cell) => cell.flagged);
      next = createBoard(level.size, level.mines, index);
      next.forEach((cell, cellIndex) => { cell.flagged = flags[cellIndex]; });
    }

    if (next[index].mine) {
      next[index].revealed = true;
      setStatus('lost');
    } else {
      const queue = [index];
      const visited = new Set<number>();
      while (queue.length > 0) {
        const current = queue.pop()!;
        if (visited.has(current) || next[current].revealed || next[current].flagged) continue;
        visited.add(current);
        next[current].revealed = true;
        if (next[current].count === 0) queue.push(...neighbors(current, level.size));
      }

      if (next.every((cell) => cell.mine || cell.revealed)) setStatus('won');
      else setStatus('playing');
    }

    setBoard(next);
  };

  const flags = board.filter((cell) => cell.flagged).length;
  const statusText = status === 'won'
    ? 'Поле расчищено. Ты победил.'
    : status === 'lost'
      ? 'Мина сработала. Поле показало все заряды.'
      : status === 'playing'
        ? 'Цифры отмечают мины вокруг открытой клетки.'
        : 'Первый ход и все соседние клетки безопасны.';

  return (
    <div className="game-controls-area mine-controls-area">
      <div className="mine-game-header">
        <div>
          <p className="game-eyebrow">ПОЛЕ САПЁРА</p>
          <h2>Открой безопасные клетки</h2>
        </div>
        <label className="mine-level-select">
          <span>Размер поля</span>
          <select value={difficulty} onChange={(event) => restart(event.target.value as Difficulty)}>
            {Object.entries(LEVELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mine-toolbar">
        <div className="mine-counter"><span aria-hidden="true">⚑</span><b>{String(level.mines - flags).padStart(2, '0')}</b><small>мин осталось</small></div>
        <button className="button button-dark mine-face" onClick={() => restart()} aria-label="Начать новую игру">
          {status === 'won' ? '✦' : status === 'lost' ? '×' : '↻'}
        </button>
        <div className="mine-counter mine-clock"><span aria-hidden="true">◷</span><b>{formatTime(seconds)}</b><small>время</small></div>
      </div>

      <div className={`mine-board${status === 'won' ? ' is-won' : ''}`} role="group" aria-label={`Поле сапёра ${level.size} на ${level.size}`}
        style={{ gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))` }}>
        {board.map((cell, index) => {
          const lostMine = status === 'lost' && cell.mine;
          const wrongFlag = status === 'lost' && cell.flagged && !cell.mine;
          const visible = cell.revealed || lostMine;
          const label = lostMine ? 'Мина' : wrongFlag ? 'Неверный флажок' : cell.flagged ? 'Флажок' : visible ? (cell.count ? `Соседних мин: ${cell.count}` : 'Пустая клетка') : 'Закрытая клетка';
          return (
            <button key={index}
              className={`mine-cell${visible ? ' is-open' : ''}${cell.flagged && !lostMine ? ' is-flagged' : ''}${lostMine ? ' is-mine' : ''}${wrongFlag ? ' is-wrong-flag' : ''}`}
              data-number={cell.count} aria-label={label} aria-pressed={cell.flagged}
              onClick={() => visible ? undefined : reveal(index)}
              onContextMenu={(event) => { event.preventDefault(); toggleFlag(index); }}>
              {lostMine ? '✹' : wrongFlag ? '×' : cell.flagged ? <span className="flag-mark">⚑</span> : visible ? cell.count || '' : ''}
            </button>
          );
        })}
      </div>

      <div className="mine-footer">
        <p className="game-live-message" role="status">{statusText}</p>
        <button className={`button button-soft${flagMode ? ' is-selected' : ''}`} aria-pressed={flagMode} onClick={() => setFlagMode((enabled) => !enabled)}>
          <span aria-hidden="true">⚑</span> {flagMode ? 'Открывать клетки' : 'Ставить флажки'}
        </button>
      </div>
    </div>
  );
}
