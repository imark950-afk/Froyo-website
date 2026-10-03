/* Small renderer for the FROYO on the go pages: fills the page template from the page logic and re-renders on changes. */
(function () {
  'use strict';
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, p);
      schedule();
    }
    forceUpdate() { schedule(); }
  }

  const tpl = document.getElementById('tpl');
  const logicEl = document.getElementById('logic');
  const root = document.getElementById('root');
  const defs = JSON.parse(logicEl.getAttribute('data-props') || '{}');
  const props = {};
  Object.keys(defs).forEach((k) => { if (k[0] !== '$' && defs[k] && 'default' in defs[k]) props[k] = defs[k].default; });
  const Component = new Function('DCLogic', logicEl.textContent + '\n;return Component;')(DCLogic);
  const comp = new Component(props);
  if (!comp.state) comp.state = {};

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  function look(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    let cur = scope;
    for (const part of path.split('.')) { if (cur == null) return undefined; cur = cur[part]; }
    return cur;
  }
  function interp(str, scope) {
    return str.replace(HOLE, (_, p) => { const v = look(p, scope); return v == null ? '' : String(v); });
  }
  const EVENTS = { onclick: 'click', onchange: 'input', oninput: 'input', onkeydown: 'keydown', onkeyup: 'keyup', onsubmit: 'submit', onfocus: 'focus', onblur: 'blur', onmouseenter: 'mouseenter', onmouseleave: 'mouseleave' };

  function renderNodes(nodes, scope, out) {
    nodes.forEach((n) => {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(interp(n.nodeValue, scope))); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const m = WHOLE.exec(n.getAttribute('list') || '');
        const list = m ? look(m[1], scope) : [];
        const as = n.getAttribute('as') || 'item';
        (Array.isArray(list) ? list : []).forEach((item, i) => {
          const s = Object.create(scope); s[as] = item; s.$index = i;
          renderNodes(Array.from(n.childNodes), s, out);
        });
        return;
      }
      if (tag === 'sc-if') {
        const m = WHOLE.exec(n.getAttribute('value') || '');
        if (m && look(m[1], scope)) renderNodes(Array.from(n.childNodes), scope, out);
        return;
      }
      const el = document.createElementNS(n.namespaceURI, n.localName);
      Array.from(n.attributes).forEach((a) => {
        const name = a.name;
        if (name.startsWith('hint-')) return;
        const m = WHOLE.exec(a.value);
        if (name.startsWith('on') && m) {
          const fn = look(m[1], scope);
          const ev = EVENTS[name.toLowerCase()] || name.slice(2).toLowerCase();
          if (typeof fn === 'function') el.addEventListener(ev, fn);
          return;
        }
        const v = interp(a.value, scope);
        el.setAttribute(name, v);
        if (name === 'value' && 'value' in el) el.value = v;
      });
      renderNodes(Array.from(n.childNodes), scope, el);
      out.appendChild(el);
    });
  }

  let queued = false;
  function schedule() { if (!queued) { queued = true; setTimeout(render, 0); } }
  let mounted = false;
  function render() {
    queued = false;
    const active = document.activeElement;
    const activeId = active && active.id && root.contains(active) ? active.id : null;
    const sel = activeId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    const frag = document.createDocumentFragment();
    renderNodes(Array.from(tpl.content.childNodes), comp.renderVals(), frag);
    root.replaceChildren(frag);
    if (activeId) {
      const again = document.getElementById(activeId);
      if (again) { again.focus({ preventScroll: true }); if (sel) try { again.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
    if (!mounted) {
      mounted = true;
      if (typeof comp.componentDidMount === 'function') comp.componentDidMount();
      if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }
  }
  window.addEventListener('pagehide', () => { if (typeof comp.componentWillUnmount === 'function') comp.componentWillUnmount(); });
  render();
})();
