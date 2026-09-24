import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Artwork from './Artwork';
import ThreeScene from './ThreeScene';
import { GAMES, type GameId, type GameInfo } from './data';

const DinoGame = lazy(() => import('./games/DinoGame'));
const MinesweeperGame = lazy(() => import('./games/MinesweeperGame'));
const SnakeGame = lazy(() => import('./games/SnakeGame'));
const SudokuGame = lazy(() => import('./games/SudokuGame'));
const SlitherGame = lazy(() => import('./games/SlitherGame'));

function SiteHeader({ onHome, onGames }: { onHome: () => void; onGames: () => void }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome} aria-label="На главную">
        <img className="brand-icon" src="/favicon.svg" alt="" />
      </button>
      <nav className="header-games-nav" aria-label="Основная навигация">
        <button className="button button-lime header-games-button" onClick={onGames}>Все игры</button>
      </nav>
      <a className="telegram-button" href="https://t.me/xhiveee" target="_blank" rel="noopener noreferrer" aria-label="Открыть Telegram xhiveee">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 2 14 22l-4-8-8-4 20-8Z" />
          <path className="telegram-fold" d="M10 14 22 2" />
        </svg>
      </a>
    </header>
  );
}

function GameCard({ game, onSelect, featured = false }: { game: GameInfo; onSelect: (id: GameId) => void; featured?: boolean }) {
  return (
    <button className={`game-card tile-${game.id}${featured ? ' is-featured' : ''}`} onClick={() => onSelect(game.id)}>
      <span className="card-topline">
        <span className="card-label">{game.label}</span>
        <span className="card-open" aria-hidden="true">↗</span>
      </span>
      <span className="card-copy">
        <span className="card-title">{game.title}</span>
        <span className="card-description">{game.cardDescription}</span>
        <span className="card-cta">Играть <span aria-hidden="true">→</span></span>
      </span>
      <span className="card-art"><Artwork game={game.id} /></span>
    </button>
  );
}

function HomePage({ onSelect }: { onSelect: (id: GameId) => void }) {
  const scrollToGames = () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="home-page">
      <section className="hero" aria-labelledby="hero-title">
        <ThreeScene variant="menu" className="hero-scene" />
        <div className="hero-light" />
        <div className="hero-copy">
          <p className="hero-kicker"><span /> gg.xhiveee.ru <b>/</b> игровая площадка</p>
          <h1 id="hero-title">Сверни ленту.<br /><span>Включи игру.</span></h1>
          <p className="hero-description">Пять игр с низкополигональным миром.<br />Без регистрации и сохранения рекордов.</p>
          <button className="button button-lime hero-button" onClick={scrollToGames}>Выбрать игру <span aria-hidden="true">↓</span></button>
        </div>
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="hero-stamp" aria-hidden="true"><span>ПАУЗА</span><b>ПО ТВОИМ<br />ПРАВИЛАМ</b><i>✳</i></div>
        <div className="hero-bottomline"><span>Пять способов отвлечься</span><span>Листай вниз <b>↓</b></span></div>
      </section>

      <section className="catalog-section" id="games" aria-labelledby="games-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Выбери игру</p>
            <h2 id="games-heading">Что запускаем?</h2>
          </div>
          <p className="section-sidecopy">Управление простое.<br />Игры начинаются сразу.</p>
        </div>
        <div className="game-grid">
          {GAMES.map((game) => <GameCard key={game.id} game={game} onSelect={onSelect} featured={game.id === 'slither'} />)}
        </div>
      </section>

    </main>
  );
}

function ActiveGame({ game }: { game: GameInfo }) {
  return (
    <Suspense fallback={<div className="game-loading" role="status">Готовим игровое поле…</div>}>
      {game.id === 'slither' && <SlitherGame />}
      {game.id === 'minesweeper' && <MinesweeperGame />}
      {game.id === 'dino' && <DinoGame />}
      {game.id === 'snake' && <SnakeGame />}
      {game.id === 'sudoku' && <SudokuGame />}
    </Suspense>
  );
}

function GamePage({ game }: { game: GameInfo }) {
  const gameRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === gameRef.current);
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    const gameInterface = gameRef.current;
    setFullscreenError('');
    if (!gameInterface || !document.fullscreenEnabled) {
      setFullscreenError('Полноэкранный режим недоступен в этом браузере.');
      return;
    }

    try {
      if (document.fullscreenElement === gameInterface) await document.exitFullscreen();
      else await gameInterface.requestFullscreen();
    } catch {
      setFullscreenError('Не удалось изменить режим экрана.');
    }
  };

  return (
    <main className={`play-page play-${game.id}`}>
      <div className="play-heading">
        <h1>{game.shortTitle}</h1>
        <p className="play-description">{game.description}</p>
      </div>

      <div className="play-layout">
        <section className="game-play-card" aria-label={game.title} ref={gameRef}>
          <div className="game-card-toolbar">
            <span className="fullscreen-game-title">{game.title}</span>
            {fullscreenError && <span className="fullscreen-error" role="status">{fullscreenError}</span>}
            <button className="fullscreen-button" type="button" onClick={() => void toggleFullscreen()}
              aria-pressed={isFullscreen} aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Включить полноэкранный режим'}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M8 21H3v-5m0 5 6-6m7 6h5v-5m0 5-6-6" />
              </svg>
              <span>{isFullscreen ? 'Выйти' : 'На весь экран'}</span>
            </button>
          </div>
          <ActiveGame key={game.id} game={game} />
        </section>

        <aside className="instruction-card">
          <div className="instruction-icon" aria-hidden="true">?</div>
          <p className="section-kicker">Коротко о правилах</p>
          <h2>{game.title}</h2>
          <p className="instruction-description">{game.hint}</p>
          <ul>
            {game.controls.map((control) => <li key={control}><span aria-hidden="true">✳</span>{control}</li>)}
          </ul>
        </aside>
      </div>
    </main>
  );
}

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const activeInfo = GAMES.find((game) => game.id === activeGame);

  const showGames = () => {
    if (activeGame) {
      setActiveGame(null);
      window.setTimeout(() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }), 0);
    } else {
      document.getElementById('games')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goHome = () => {
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectGame = (id: GameId) => {
    setActiveGame(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <SiteHeader onHome={goHome} onGames={showGames} />
      {activeInfo ? <GamePage key={activeInfo.id} game={activeInfo} /> : <HomePage onSelect={selectGame} />}
    </div>
  );
}
