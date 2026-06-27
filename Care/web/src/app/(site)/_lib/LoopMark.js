/* Four people connected in a care circle, matching the Colaris identity. */
export default function LoopMark({ size = 26, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="colaris-mark" x1="10" y1="8" x2="55" y2="57" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <g fill="url(#colaris-mark)">
        <circle cx="32" cy="7.5" r="6.2" />
        <circle cx="56.5" cy="32" r="6.2" />
        <circle cx="32" cy="56.5" r="6.2" />
        <circle cx="7.5" cy="32" r="6.2" />
      </g>
      <g stroke="url(#colaris-mark)" strokeWidth="7" strokeLinecap="round">
        <path d="M20.5 12.5C14.5 15.1 11 19 9.2 24" />
        <path d="M51.5 20.5C48.9 14.5 45 11 40 9.2" />
        <path d="M43.5 51.5C49.5 48.9 53 45 54.8 40" />
        <path d="M12.5 43.5C15.1 49.5 19 53 24 54.8" />
      </g>
    </svg>
  );
}
