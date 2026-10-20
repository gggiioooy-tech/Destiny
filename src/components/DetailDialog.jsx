import React, { useId, useLayoutEffect, useRef } from 'react';
export default function DetailDialog({ title, onClose, children }) {
  const dialog = useRef(null), titleId = useId();
  useLayoutEffect(() => {
    const previousFocus = document.activeElement, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => {
      dialog.current?.close(); document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} className="site-detail-dialog text-zinc-950" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className="min-w-0">
      <header className="detail-dialog-header sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:px-6">
        <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">{title}</h2>
        <button type="button" autoFocus aria-label="상세 닫기" onClick={onClose} className="site-button site-button-secondary shrink-0 border border-zinc-200 px-3 py-2 text-sm">닫기 ×</button>
      </header>
      <div className="min-w-0 p-4 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
