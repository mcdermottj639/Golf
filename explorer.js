/* Caddie HQ Explorer: a read-only doorway into the existing app and its records. */
(() => {
  'use strict';

  let dialog = null;
  let input = null;
  let results = null;
  let status = null;
  let previousFocus = null;
  let activeIndex = -1;
  let resultButtons = [];
  let renderedQuery = '';
  let searchTimer = 0;
  let revision = 0;
  let pendingOpen = false;

  const svgSearch = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>';
  const actionFields = {
    a: 'action', v: 'view', view: 'view', seg: 'seg', id: 'id', i: 'i',
    metric: 'metric', prov: 'prov', value: 'value', unit: 'unit',
    kind: 'kind', club: 'club', shelf: 'shelf', disc: 'disc', target: 'target',
  };

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  }

  function ensureDialog() {
    if (dialog) return true;
    if (!document.body) return false;
    dialog = make('dialog', 'hq-explorer');
    dialog.id = 'hq-explorer';
    dialog.setAttribute('aria-labelledby', 'hq-explorer-title');
    dialog.innerHTML = `
      <section class="hq-explorer-panel">
        <div class="hq-explorer-head">
          <div><p class="hq-explorer-eyebrow">YOUR GOLF, CONNECTED</p><h2 id="hq-explorer-title">Explore Caddie HQ</h2></div>
          <button type="button" class="hq-explorer-close" aria-label="Close Explorer"><span aria-hidden="true">×</span></button>
        </div>
        <label class="hq-explorer-search" for="hq-explorer-input">
          ${svgSearch}
          <input id="hq-explorer-input" class="hq-explorer-input" type="search" placeholder="Find a club, round, number or lesson…" aria-label="Search all your golf" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="hq-explorer-results" aria-describedby="hq-explorer-hint" autocomplete="off" autocapitalize="off" spellcheck="false">
        </label>
        <p id="hq-explorer-hint" class="hq-explorer-hint">Try a club, course, date or metric. Everything opens in its original place.</p>
        <p id="hq-explorer-status" class="hq-explorer-status" role="status" aria-live="polite" aria-atomic="true"></p>
        <div id="hq-explorer-results" class="hq-explorer-results" role="listbox" aria-label="Golf destinations and search results"></div>
        <div class="hq-explorer-footer"><span>↑ ↓ choose · Enter open</span><span>Esc close · ⌘ / Ctrl K explore</span></div>
      </section>`;
    document.body.appendChild(dialog);
    input = dialog.querySelector('#hq-explorer-input');
    results = dialog.querySelector('#hq-explorer-results');
    status = dialog.querySelector('#hq-explorer-status');

    dialog.querySelector('.hq-explorer-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('close', afterClose);
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      revision += 1;
      setActive(-1);
      results.setAttribute('aria-busy', 'true');
      resultButtons.forEach(button => { button.disabled = true; });
      searchTimer = window.setTimeout(() => refresh(input.value), 100);
    });
    dialog.addEventListener('keydown', async event => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        // A search input otherwise consumes the first Escape just to clear itself.
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      const inInput = event.target === input;
      const inResult = event.target.closest?.('.hq-explorer-link');
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (inInput || inResult)) {
        event.preventDefault();
        if (results.getAttribute('aria-busy') === 'true' || input.value.trim() !== renderedQuery) {
          const query = input.value;
          clearTimeout(searchTimer);
          await refresh(query);
          if (!dialog.open || input.value !== query) return;
          if (resultButtons.length) setActive(event.key === 'ArrowUp' ? resultButtons.length - 1 : 0, true);
          return;
        }
        if (!resultButtons.length) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (activeIndex + delta + resultButtons.length) % resultButtons.length;
        setActive(next, true);
        input.focus({ preventScroll: true });
      } else if (event.key === 'Enter' && inInput) {
        event.preventDefault();
        if (results.getAttribute('aria-busy') === 'true' || input.value.trim() !== renderedQuery) {
          const query = input.value;
          clearTimeout(searchTimer);
          await refresh(query);
          if (!dialog.open || input.value !== query) return;
        }
        resultButtons[activeIndex]?.click();
      }
    });
    results.addEventListener('focusin', event => {
      const button = event.target.closest('.hq-explorer-link');
      if (button) setActive(Number(button.dataset.resultIndex));
    });
    return true;
  }

  function setActive(index, reveal = false) {
    activeIndex = index;
    resultButtons.forEach((button, i) => {
      const selected = i === index;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    const button = resultButtons[index];
    if (button) {
      input.setAttribute('aria-activedescendant', button.id);
      if (reveal) button.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function draw(rows, query) {
    renderedQuery = query;
    results.removeAttribute('aria-busy');
    results.replaceChildren();
    resultButtons = [];
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    const usable = Array.isArray(rows) ? rows.filter(row => row && row.label && row.act?.a) : [];
    const grouped = new Map();
    usable.forEach(row => {
      const kind = row.kind || 'Explore';
      if (!grouped.has(kind)) grouped.set(kind, []);
      grouped.get(kind).push(row);
    });
    if (!usable.length) {
      status.textContent = query ? `No results for “${query}”.` : 'Your golf is loading.';
      const empty = make('div', 'hq-explorer-empty');
      empty.appendChild(make('strong', '', query ? 'Try a different word' : 'Open Explorer again in a moment'));
      empty.appendChild(make('p', '', query ? 'Search a club such as 5W, a course, “carry”, “putting” or “practice”.' : 'Your saved records will be available as soon as the app is ready.'));
      results.appendChild(empty);
      return;
    }

    let groupIndex = 0;
    grouped.forEach((groupRows, kind) => {
      const group = make('section', 'hq-explorer-group');
      group.setAttribute('role', 'group');
      const heading = make('h3', '', kind);
      heading.id = `hq-explorer-group-${groupIndex++}`;
      heading.appendChild(make('span', 'hq-explorer-count', groupRows.length));
      group.setAttribute('aria-labelledby', heading.id);
      group.appendChild(heading);
      groupRows.forEach(row => {
        const index = resultButtons.length;
        const button = make('button', 'hq-explorer-link');
        button.type = 'button';
        button.id = `hq-explorer-result-${index}`;
        button.dataset.resultIndex = String(index);
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', 'false');
        Object.entries(actionFields).forEach(([field, attribute]) => {
          if (field === 'view' && row.act.v != null) return;
          const value = row.act[field];
          if (value != null && value !== '') button.dataset[attribute] = String(value);
        });
        const copy = make('span', 'hq-explorer-copy');
        copy.appendChild(make('strong', '', row.label));
        if (row.description) copy.appendChild(make('small', '', row.description));
        button.appendChild(copy);
        const arrow = make('span', 'hq-explorer-arrow', '↗');
        arrow.setAttribute('aria-hidden', 'true');
        button.appendChild(arrow);
        group.appendChild(button);
        resultButtons.push(button);
      });
      results.appendChild(group);
    });
    status.textContent = query
      ? `${usable.length} result${usable.length === 1 ? '' : 's'} for “${query}”`
      : `${usable.length} places to explore · start anywhere`;
    setActive(0);
    results.scrollTop = 0;
  }

  async function refresh(rawQuery = '') {
    const query = String(rawQuery || '').trim();
    const request = ++revision;
    const api = window.CaddieHQ;
    try {
      const rows = await Promise.resolve(query ? api?.search?.(query) : api?.explore?.());
      if (request !== revision || !dialog?.open) return;
      draw(rows, query);
    } catch {
      if (request !== revision || !dialog?.open) return;
      draw([], query);
      status.textContent = 'Search is unavailable right now. Your records are unchanged.';
    }
  }

  function afterClose() {
    clearTimeout(searchTimer);
    revision += 1;
    input?.removeAttribute('aria-activedescendant');
    const target = previousFocus;
    previousFocus = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
  }

  function open() {
    if (!ensureDialog()) {
      pendingOpen = true;
      return;
    }
    pendingOpen = false;
    if (dialog.open) {
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    previousFocus = document.activeElement;
    input.value = '';
    dialog.showModal();
    input.focus({ preventScroll: true });
    refresh();
  }

  function close() {
    pendingOpen = false;
    if (!dialog?.open) return;
    // Cancel a pending query before its promise or debounce can redraw a closed menu.
    clearTimeout(searchTimer);
    revision += 1;
    dialog.close();
  }

  // Close during capture, then let the existing app action delegate handle the same
  // button once. No cloned action handler, fake navigation or second copy of app state.
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.hq-search-trigger, [data-action="hq-explore"]')) {
      event.preventDefault();
      open();
      return;
    }
    if (!dialog?.open) return;
    if (target.closest('#hq-explorer .hq-explorer-link')) {
      close();
      return;
    }
    if (target === dialog) close();
  }, true);

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
    }
  });

  window.CaddieExplorer = Object.freeze({ open, close });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureDialog();
      if (pendingOpen) open();
    }, { once: true });
  } else {
    ensureDialog();
  }
})();
