import type { GameId } from './data';

export default function Artwork({ game }: { game: GameId }) {
  if (game === 'slither') {
    return (
      <svg viewBox="0 0 220 160" role="img" aria-label="Длинная зелёная змейка собирает светящиеся шарики">
        <path d="M12 137 41 88l30 24 34-58 36 28 38-46 29 31v80H12z" fill="#b1d77c" />
        <path d="m12 137 29-49 30 24-17 48H12z" fill="#8cbd70" />
        <path d="m105 54 36 28-34 78H54z" fill="#97c87c" />
        <path d="m141 82 38-46 29 31v93h-101z" fill="#bedb88" />
        <path d="M29 110c19-24 32-20 42-4 10 16 22 19 34 2 13-19 23-24 37-10 12 13 22 16 34-1" fill="none" stroke="#438f67" strokeLinecap="round" strokeWidth="23" />
        <path d="M30 107c17-20 29-17 40-2m39 1c12-16 23-21 35-8m37-1c9 8 16 9 25 1" fill="none" stroke="#6dbd7b" strokeLinecap="round" strokeWidth="8" />
        <path d="m174 87 15-10 14 7 1 17-14 10-15-8z" fill="#356e5d" />
        <circle cx="190" cy="88" r="3" fill="#fff8d7" /><circle cx="199" cy="87" r="2" fill="#24484d" />
        <path d="m74 44 6-11 6 11 11 5-11 5-6 11-6-11-11-5z" fill="#f4cb5f" />
        <path d="m119 28 4-7 4 7 8 3-8 4-4 7-4-7-7-4z" fill="#f38d6c" />
        <path d="m50 59 4-7 4 7 7 3-7 3-4 7-4-7-7-3z" fill="#eee77a" />
      </svg>
    );
  }

  if (game === 'minesweeper') {
    return (
      <svg viewBox="0 0 220 160" role="img" aria-label="Поле сапёра с флажком">
        <g transform="translate(39 22) rotate(-8 70 57)">
          <path d="M0 20 74 0l75 20-74 24z" fill="#dbe6ff" />
          <path d="m0 20 75 24v85L0 104z" fill="#aabcf4" />
          <path d="m75 44 74-24v84l-74 25z" fill="#778ee6" />
          <path d="m24 26 25-7 25 8-25 8z" fill="#f7f8ff" />
          <path d="m74 35 25-8 25 8-25 8z" fill="#b5c3fb" />
          <path d="m24 48 25 8v28l-25-8z" fill="#f7f8ff" />
          <path d="m50 56 25 8v28l-25-8z" fill="#c4d0ff" />
          <path d="m77 65 25-8v28l-25 8z" fill="#eff2ff" />
          <path d="m104 56 24-8v28l-24 8z" fill="#b5c3fb" />
          <path d="M120 10v31m0-31 23 8-23 8" fill="none" stroke="#ff745e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          <circle cx="100" cy="99" r="10" fill="#313755" />
          <path d="m96 95 8 8m0-8-8 8" stroke="#ff745e" strokeWidth="3" />
        </g>
      </svg>
    );
  }

  if (game === 'dino') {
    return (
      <svg viewBox="0 0 220 160" role="img" aria-label="Динозаврик перепрыгивает кактус">
        <circle cx="167" cy="36" r="19" fill="#ffcb52" />
        <path d="M0 119 42 71l32 38 47-58 56 70z" fill="#e3a675" />
        <path d="m42 71 32 38-27 51H0v-41z" fill="#d8946d" />
        <path d="M0 133h220v27H0z" fill="#704b42" />
        <path d="M25 130h26m20 0h16m23 0h26m22 0h20" stroke="#f8c77b" strokeWidth="4" />
        <path d="M72 94h41v23h-8v15H85v-11H72zm29-19h20v22h-8v13h-17V93h5z" fill="#436956" />
        <path d="M118 123h11v25h-11zm-31 0h11v25H87z" fill="#304b44" />
        <circle cx="117" cy="84" r="2.5" fill="#f4f2e8" />
        <path d="M169 95h12v12h9v33h-9v-12h-7v18h-11v-18h-8v-20h14z" fill="#548447" />
      </svg>
    );
  }

  if (game === 'snake') {
    return (
      <svg viewBox="0 0 220 160" role="img" aria-label="Зелёная змейка и яблоко">
        <path d="m21 118 70-30 63 24-70 33z" fill="#99e9b4" />
        <path d="m21 118 63 27v-36L21 82z" fill="#5dbb8c" />
        <path d="m84 109 70 3V76l-70-21z" fill="#70cc9a" />
        <path d="m39 103 21-10 18 8-21 10z" fill="#d8f7df" />
        <path d="m59 113 21-10 18 8-21 10z" fill="#d8f7df" />
        <path d="m79 123 21-10 18 8-21 10z" fill="#d8f7df" />
        <path d="m98 131 22-10 20 8-22 10z" fill="#d8f7df" />
        <path d="m125 62 8-12 8 12 12 4-12 6-8 13-8-13-11-6z" fill="#ff745e" />
        <path d="m132 49 8-5 3 3-9 6" fill="#416b53" />
        <circle cx="132" cy="64" r="2" fill="#fff4d8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 160" role="img" aria-label="Объёмная сетка судоку">
      <g transform="translate(35 19) rotate(-7 77 60)">
        <path d="M0 15 75 0l78 19-77 21z" fill="#e6ddff" />
        <path d="m0 15 76 25v83L0 98z" fill="#c3b2fa" />
        <path d="m76 40 77-21v83l-77 21z" fill="#9c82ea" />
        <path d="m16 21 19-5 19 6-19 5zm40-10 19-5 19 6-19 5zm40 10 19-5 19 6-19 5z" fill="#fff" />
        <path d="m17 40 19 6v16l-19-6zm20 7 19 6v16l-19-6zm40-1 19-5v16l-19 5zm20 16 19-5v16l-19 5z" fill="#fff" />
        <path d="M58 26v73M102 15v73M0 49l76 25m-76 4 76 25m0-59 77-21m-77 48 77-21m-77 49 77-21" fill="none" stroke="#725bc3" strokeWidth="2" />
        <path d="m65 57 6 2m32 18 6-2m-70 6 6 2" stroke="#ff745e" strokeLinecap="round" strokeWidth="4" />
      </g>
    </svg>
  );
}
