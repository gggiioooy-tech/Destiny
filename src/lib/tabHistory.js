const TAB_STATE = '15monthTab';
export function readTab(browser, fallback = 'attack') {
  const url = new URL(browser.location.href);
  const tab = url.searchParams.get('tab') || browser.history.state?.[TAB_STATE];
  return typeof tab === 'string' && tab.length > 0 && tab.length <= 200 ? tab : fallback;
}
export function createTabHistory(browser, onChange, fallback = 'attack') {
  let current = readTab(browser, fallback);
  const write = (tab, replace) => {
    const url = new URL(browser.location.href);
    url.searchParams.set('tab', tab);
    const state = { ...(browser.history.state || {}), [TAB_STATE]: tab };
    browser.history[replace ? 'replaceState' : 'pushState'](state, '', url.href);
  };
  const change = (next, replace) => {
    const tab = typeof next === 'function' ? next(current) : next;
    if (typeof tab !== 'string' || !tab || tab.length > 200) return;
    if (!replace && tab === current) return;
    write(tab, replace); current = tab; onChange(tab);
  };
  const pop = () => { current = readTab(browser, fallback); onChange(current); };
  write(current, true);
  browser.addEventListener('popstate', pop);
  return {
    navigate: next => change(next, false),
    replace: next => change(next, true),
    destroy: () => browser.removeEventListener('popstate', pop),
  };
}
