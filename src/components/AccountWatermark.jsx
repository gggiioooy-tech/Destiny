import React from 'react';
import { createPortal } from 'react-dom';

// Fixed to the viewport center without intercepting clicks or selection.
export default function AccountWatermark({ nickname }) {
  const name = String(nickname || '').trim();
  if (!name) return null;
  return createPortal(
    <div data-account-watermark="" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, pointerEvents: 'none', userSelect: 'none', overflow: 'hidden' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style={{ display: 'block', pointerEvents: 'none' }}>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontFamily="sans-serif" fontWeight="600" fontSize="24" fill="#233047" fillOpacity="0.19" stroke="#fff" strokeOpacity="0.24" strokeWidth="1" paintOrder="stroke" textLength={Array.from(name).length > 12 ? 280 : undefined} lengthAdjust="spacingAndGlyphs">{name}</text>
      </svg>
    </div>, document.body,
  );
}
