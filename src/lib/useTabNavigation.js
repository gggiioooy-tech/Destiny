import { useCallback, useEffect, useRef, useState } from 'react';
import { createTabHistory, readTab } from './tabHistory.js';
export function useTabNavigation() {
  const [active, setActive] = useState(() => readTab(window));
  const history = useRef(null);
  useEffect(() => {
    const controller = createTabHistory(window, setActive);
    history.current = controller;
    return () => { controller.destroy(); history.current = null; };
  }, []);
  const navigate = useCallback(next => history.current?.navigate(next), []);
  const replace = useCallback(next => history.current?.replace(next), []);
  return [active, navigate, replace];
}
