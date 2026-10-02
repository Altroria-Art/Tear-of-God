// Original vector sticker. Instructions and meaning always live in adjacent text.
export default function TearMascot({ pose = 'welcome', className = '' }) {
  const quiet = pose === 'quiet';
  const point = pose === 'point';
  return (
    <svg className={`tear-mascot ${className}`} data-pose={pose} viewBox="0 0 160 160" aria-hidden="true" focusable="false" fill="none">
      <g stroke="var(--color-acid-ink)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M52 136l-9 9m62-10 11 8" />
        <path d="M81 15C79 43 35 58 33 93c-2 29 19 48 48 48 30 0 49-20 47-46-2-30-23-48-47-80Z" fill="var(--color-pop-violet)" transform="translate(4 4)" />
        <path d="M81 15C79 43 35 58 33 93c-2 29 19 48 48 48 30 0 49-20 47-46-2-30-23-48-47-80Z" fill="var(--color-acid)" />
        <path d="M45 74c6-13 18-20 26-29" stroke="var(--color-hero-ink)" strokeWidth="7" />
        {quiet ? <path d="M58 90l12 3m21 0 12-3" /> : <><path d="M62 87v8m35-8v8" /><path d="M88 77l15-2" strokeWidth="3" /></>}
        <path d={quiet ? 'M75 110h11' : 'M72 108q10 10 20-2'} />
        <path d={point ? 'M122 103l19-16m-6-4 13 1-2 13' : quiet ? 'M35 107l-10 5m100-5 9 5' : 'M34 102l-15-15m106 15 14-21m-2-8 5 4 7-2'} />
        {!quiet && <path d="m136 31 2-8m7 15 8-1" stroke="var(--color-pop-cyan)" strokeWidth="4" />}
      </g>
    </svg>
  );
}
