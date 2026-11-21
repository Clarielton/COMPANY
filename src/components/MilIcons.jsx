import React from 'react';

export function IconCrosshair({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function IconGlobe({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function IconMedal({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2h8l-2 7h-4L8 2z" />
      <circle cx="12" cy="15" r="6" />
      <polygon points="12 11.8 13.1 14.1 15.6 14.4 13.8 16.1 14.2 18.6 12 17.4 9.8 18.6 10.2 16.1 8.4 14.4 10.9 14.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCamera({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <polygon points="16 10 22 7 22 17 16 14" />
      <circle cx="9" cy="12" r="2.5" />
    </svg>
  );
}

export function IconCompass({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

export function IconSupply({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <polyline points="3.27 8.2 12 13 20.73 8.2" />
      <line x1="12" y1="22" x2="12" y2="13" />
    </svg>
  );
}

export function IconBook({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="16" y2="7" />
      <line x1="9" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function IconShield({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function IconPlay({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function IconEyeOff({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconFastForward({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="3 6 12 12 3 18 3 6" />
      <polygon points="13 6 22 12 13 18 13 6" />
    </svg>
  );
}

export function IconBolt({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconGold({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" fill="#c28e38" stroke="#fde047" />
      <polygon points="12 7 13.6 10.3 17.2 10.8 14.6 13.3 15.2 17 12 15.2 8.8 17 9.4 13.3 6.8 10.8 10.4 10.3" fill="#141712" stroke="none" />
    </svg>
  );
}

export function IconLogout({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ============================================================================
   ÍCONES VETORIAIS EXCLUSIVOS DO JOGO (HUD, TROPAS, BLINDADOS, RECURSOS E AÇÕES)
   ============================================================================ */

export function IconInfantry({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 13a8 8 0 0 1 16 0v2H4v-2z" />
      <path d="M2 15h20v2H2z" />
      <path d="M7 17l2 4h6l2-4" />
    </svg>
  );
}

export function IconTank({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="14" width="20" height="5" rx="2.5" />
      <path d="M6 14l2-5h7l2 5" />
      <line x1="15" y1="11" x2="23" y2="11" />
      <circle cx="6" cy="16.5" r="1" fill="currentColor" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
      <circle cx="18" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconWrench({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function IconBunker({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 20h18v-8l-3-5H6l-3 5v8z" />
      <rect x="7" y="11" width="10" height="3" />
      <line x1="12" y1="11" x2="12" y2="14" />
    </svg>
  );
}

export function IconBuilding({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <rect x="9" y="13" width="6" height="8" />
      <line x1="9" y1="9" x2="15" y2="9" />
    </svg>
  );
}

export function IconAir({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l2 7 8 3-8 2-2 8-2-8-8-2 8-3 2-7z" />
    </svg>
  );
}

export function IconDrone({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <line x1="9.5" y1="9.5" x2="5" y2="5" />
      <line x1="14.5" y1="9.5" x2="19" y2="5" />
      <line x1="9.5" y1="14.5" x2="5" y2="19" />
      <line x1="14.5" y1="14.5" x2="19" y2="19" />
      <circle cx="5" cy="5" r="2.5" />
      <circle cx="19" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
    </svg>
  );
}

export function IconResearch({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 3h6" />
      <path d="M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
      <line x1="7.5" y1="14" x2="16.5" y2="14" />
    </svg>
  );
}

export function IconAmmo({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 21V10l2.5-6L12 10v11H7z" />
      <path d="M14 21V10l2.5-6L19 10v11h-5z" />
      <line x1="7" y1="16" x2="12" y2="16" />
      <line x1="14" y1="16" x2="19" y2="16" />
    </svg>
  );
}

export function IconFuel({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="6" width="14" height="15" rx="2" />
      <path d="M8 6V3h6v3" />
      <line x1="8" y1="11" x2="14" y2="17" />
      <line x1="14" y1="11" x2="8" y2="17" />
    </svg>
  );
}

export function IconStar({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" />
    </svg>
  );
}

export function IconGrenade({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="14" rx="6" ry="7" />
      <path d="M10 7V4h4v3" />
      <path d="M14 4h4l1 3" />
      <line x1="7" y1="14" x2="17" y2="14" />
    </svg>
  );
}

export function IconFlame({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2c1.5 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-3 2-5.5 3-7 0 2 1.5 3 2 3 0-3 0-5 0-7z" />
    </svg>
  );
}

export function IconMedkit({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4h6v2" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

export function IconLock({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconUnlock({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-1.5" />
    </svg>
  );
}

export function IconParachute({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11a9 9 0 0 1 18 0H3z" />
      <line x1="4" y1="11" x2="12" y2="19" />
      <line x1="20" y1="11" x2="12" y2="19" />
      <line x1="12" y1="11" x2="12" y2="19" />
      <circle cx="12" cy="20.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconGear({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function IconBell({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function GameCategoryIcon({ catId, size = 14 }) {
  if (catId === 'infantry') return <IconInfantry size={size} />;
  if (catId === 'vehicles') return <IconTank size={size} />;
  if (catId === 'engineering') return <IconWrench size={size} />;
  if (catId === 'defenses') return <IconBunker size={size} />;
  return <IconCrosshair size={size} />;
}
