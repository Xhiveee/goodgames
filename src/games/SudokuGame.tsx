import { useEffect, useState } from 'react';

type Difficulty = 'calm' | 'normal' | 'hard';
type Grid = number[][];

interface Puzzle {
  clues: Grid;
  solution: Grid;
}

interface Selection {
  row: number;
  column: number;
}

const difficultyLabels: Record<Difficulty, string> = {
  calm: 'Спокойно',
  normal: 'Обычно',
  hard: 'Посложнее',
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const choice = Math.floor(Math.random() * (index + 1));
    [result[index], result[choice]] = [result[choice], result[index]];
  }
  return result;
}

function countSolutions(grid: Grid, limit = 2): number {
  let bestCell: Selection | null = null;
  let bestCandidates: number[] = [];

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (grid[row][column] !== 0) continue;
      const blockRow = Math.floor(row / 3) * 3;
      const blockColumn = Math.floor(column / 3) * 3;
      const used = new Set<number>();
      for (let index = 0; index < 9; index += 1) {
        used.add(grid[row][index]);
        used.add(grid[index][column]);
        used.add(grid[blockRow + Math.floor(index / 3)][blockColumn + (index % 3)]);
      }
      const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((value) => !used.has(value));
      if (candidates.length === 0) return 0;
      if (!bestCell || candidates.length < bestCandidates.length) {
        bestCell = { row, column };
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (bestCandidates.length === 1) break;
  }

  if (!bestCell) return 1;
  let solutions = 0;
  for (const candidate of bestCandidates) {
    grid[bestCell.row][bestCell.column] = candidate;
    solutions += countSolutions(grid, limit - solutions);
    grid[bestCell.row][bestCell.column] = 0;
    if (solutions >= limit) break;
  }
  return solutions;
}

function makePuzzle(difficulty: Difficulty): Puzzle {
  const rowGroups = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((row) => group * 3 + row));
  const columnGroups = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((column) => group * 3 + column));
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const solution = rowGroups.map((row) => columnGroups.map((column) => digits[(row * 3 + Math.floor(row / 3) + column) % 9]));
  const clues = solution.map((row) => [...row]);
  const blanks: Record<Difficulty, number> = { calm: 38, normal: 46, hard: 52 };

  let removed = 0;
  for (const index of shuffle(Array.from({ length: 81 }, (_, cell) => cell))) {
    if (removed >= blanks[difficulty]) break;
    const row = Math.floor(index / 9);
    const column = index % 9;
    const value = clues[row][column];
    clues[row][column] = 0;
    if (countSolutions(clues) === 1) removed += 1;
    else clues[row][column] = value;
  }

  return { clues, solution };
}

function firstEmpty(grid: Grid): Selection {
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (grid[row][column] === 0) return { row, column };
    }
  }
  return { row: 0, column: 0 };
}

export default function SudokuGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('calm');
  const [puzzle, setPuzzle] = useState(() => makePuzzle('calm'));
  const [entries, setEntries] = useState<Grid>(() => puzzle.clues.map((row) => [...row]));
  const [selected, setSelected] = useState<Selection>(() => firstEmpty(puzzle.clues));
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('Выбери пустую клетку и поставь цифру.');
  const [solved, setSolved] = useState(false);

  const setCell = (value: number) => {
    if (solved || !selected || puzzle.clues[selected.row][selected.column] !== 0) return;
    const next = entries.map((row) => [...row]);
    next[selected.row][selected.column] = value;
    setEntries(next);
    setWrongCells(new Set());
    setMessage('');
  };

  const clearCell = () => {
    if (solved || !selected || puzzle.clues[selected.row][selected.column] !== 0) return;
    const next = entries.map((row) => [...row]);
    next[selected.row][selected.column] = 0;
    setEntries(next);
    setWrongCells(new Set());
    setMessage('Клетка очищена.');
  };

  const startNewPuzzle = (nextDifficulty = difficulty) => {
    const nextPuzzle = makePuzzle(nextDifficulty);
    setDifficulty(nextDifficulty);
    setPuzzle(nextPuzzle);
    setEntries(nextPuzzle.clues.map((row) => [...row]));
    setSelected(firstEmpty(nextPuzzle.clues));
    setWrongCells(new Set());
    setMessage('Новая сетка готова.');
    setSolved(false);
  };

  const checkPuzzle = () => {
    const incorrect = new Set<string>();
    const empty = new Set<string>();
    let isComplete = true;
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        if (entries[row][column] === 0) {
          isComplete = false;
          empty.add(`${row}:${column}`);
        } else if (entries[row][column] !== puzzle.solution[row][column]) {
          incorrect.add(`${row}:${column}`);
        }
      }
    }

    if (!isComplete) {
      setWrongCells(empty);
      setMessage('Остались пустые клетки. Отмечены розовым.');
    } else if (incorrect.size > 0) {
      setWrongCells(incorrect);
      setMessage(`Нашлось ошибок: ${incorrect.size}. Попробуй ещё раз.`);
    } else {
      setWrongCells(new Set());
      setMessage('Верно. Судоку решено!');
      setSolved(true);
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key >= '1' && event.key <= '9') setCell(Number(event.key));
      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') clearCell();
      if (!selected) return;

      if (event.key.startsWith('Arrow')) event.preventDefault();
      if (event.key === 'ArrowUp') setSelected((cell) => ({ ...cell, row: Math.max(0, cell.row - 1) }));
      if (event.key === 'ArrowDown') setSelected((cell) => ({ ...cell, row: Math.min(8, cell.row + 1) }));
      if (event.key === 'ArrowLeft') setSelected((cell) => ({ ...cell, column: Math.max(0, cell.column - 1) }));
      if (event.key === 'ArrowRight') setSelected((cell) => ({ ...cell, column: Math.min(8, cell.column + 1) }));
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected, entries, puzzle, solved]);

  const selectedValue = selected ? entries[selected.row][selected.column] : 0;

  return (
    <div className="game-controls-area sudoku-controls-area">
      <div className="sudoku-toolbar">
        <p className="game-live-message" role="status">{message || 'Цифры не повторяются в строке, столбце и блоке.'}</p>
        <label className="difficulty-select">
          <span>Сложность</span>
          <select value={difficulty} onChange={(event) => startNewPuzzle(event.target.value as Difficulty)}>
            {Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="sudoku-board" role="group" aria-label="Судоку 9 на 9">
        {entries.flatMap((rowValues, row) => rowValues.map((value, column) => {
          const key = `${row}:${column}`;
          const isSelected = selected?.row === row && selected.column === column;
          const sameRowOrColumn = selected?.row === row || selected?.column === column;
          const sameBlock = selected && Math.floor(selected.row / 3) === Math.floor(row / 3) && Math.floor(selected.column / 3) === Math.floor(column / 3);
          const sameValue = Boolean(selectedValue && value === selectedValue);
          const fixed = puzzle.clues[row][column] !== 0;
          return (
            <button key={key} aria-pressed={isSelected}
              aria-label={`Строка ${row + 1}, столбец ${column + 1}${fixed ? ', задано' : ''}${value ? `, ${value}` : ', пусто'}`}
              className={`sudoku-cell${fixed ? ' is-fixed' : ''}${isSelected ? ' is-active' : ''}${sameValue ? ' is-same-value' : ''}${!isSelected && (sameRowOrColumn || sameBlock) ? ' is-related' : ''}${wrongCells.has(key) ? ' is-wrong' : ''}`}
              onClick={() => setSelected({ row, column })}>
              {value || ''}
            </button>
          );
        }))}
      </div>

      <div className="sudoku-numbers" aria-label="Цифры">
        {Array.from({ length: 9 }, (_, index) => (
          <button key={index} className={`number-key${selectedValue === index + 1 ? ' is-current' : ''}`} onClick={() => setCell(index + 1)}>{index + 1}</button>
        ))}
        <button className="number-key clear-key" aria-label="Очистить клетку" onClick={clearCell}>×</button>
      </div>
      <div className="sudoku-footer">
        <button className="button button-soft" onClick={() => startNewPuzzle()}>Новая сетка</button>
        <button className="button button-dark" onClick={checkPuzzle}>{solved ? 'Решено ✓' : 'Проверить'}</button>
      </div>
    </div>
  );
}
