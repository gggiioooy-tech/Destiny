import React, { useId } from 'react';
import { createPortal } from 'react-dom';

// Always above site content and dialogs, without intercepting clicks or selection.
export default function AccountWatermark({ nickname, siteName }) {
  const patternId = useId();
  const name = String(nickname || '').trim();
  if (!name) return null;
  return createPortal(
    <div data-account-watermark="" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, pointerEvents: 'none', userSelect: 'none', overflow: 'hidden' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style={{ display: 'block', pointerEvents: 'none' }}>
        <defs>
          <pattern id={patternId} width="280" height="170" patternUnits="userSpaceOnUse">
            <g transform="translate(140 85) rotate(-24)" textAnchor="middle" fontFamily="sans-serif" fontWeight="600">
              <text y="0" fontSize="20" fill="#233047" fillOpacity="0.19" stroke="#fff" strokeOpacity="0.24" strokeWidth="1" paintOrder="stroke" textLength={Array.from(name).length > 12 ? 240 : undefined} lengthAdjust="spacingAndGlyphs">{name}</text>
              <text y="21" fontSize="11" fill="#233047" fillOpacity="0.16" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.7" paintOrder="stroke">{siteName} · 열람 계정</text>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>, document.body,
  );
}
