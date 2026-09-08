import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { translateRemasterPhase } from '../lib/remasterProgress.js';

const cases = [
  ['NanoVsrRestorationDialog', 'restoration'],
  ['SmartDenoiseDialog', 'denoise'],
  ['MiganRepairDialog', 'repair'],
];
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
function renderDialog(componentName, propName) {
  const code = transformSync(readFileSync(new URL(`./${componentName}.jsx`, import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  const states = []; const pending = []; const cleanups = []; let cursor = 0;
  const calls = { modal: 0, close: 0, dismiss: 0, focus: 0, restore: 0, run: 0, cancel: 0, apply: 0 };
  const trigger = { isConnected: true, focus() { calls.restore++; } };
  const document = { body: {}, activeElement: trigger };
  const nativeDialog = { open: false, showModal() { this.open = true; calls.modal++; }, close() { this.open = false; calls.close++; }, querySelector() { return { focus() { calls.focus++; } }; }, focus() { calls.focus++; } };
  const api = { dialogOpen: true, job: { running: false, progress: 0 }, result: { url: 'blob:output' }, clipPreview: { url: 'blob:output' }, regions: [], mode: 'auto',
    closeDialog() { calls.dismiss++; }, run() { calls.run++; }, runFrame() { calls.run++; }, runClip() { calls.run++; }, cancel() { calls.cancel++; }, apply() { calls.apply++; return true; } };
  const props = { [propName]: api, segment: { id: 'video', type: 'video', src: 'blob:own', width: 1080, height: 1920, duration: 4, sourceStart: 2 }, t: (key) => key };
  const jsx = (type, props) => ({ type, props });
  const context = { module: { exports: {} }, document, window: { addEventListener() {}, removeEventListener() {} }, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-dom') return { createPortal: (node) => node };
    if (id === '@phosphor-icons/react') return new Proxy({}, { get: (_, name) => name });
    if (id.endsWith('remasterProgress.js')) return { translateRemasterPhase };
    if (id === 'react') return {
      useRef(value) { const index = cursor++; return states[index] ??= { current: value }; },
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
      useEffect(effect, dependencies) { const index = cursor++; if (!states[index] || dependencies.some((value, i) => value !== states[index][i])) { states[index] = dependencies; pending.push(effect); } },
    };
    throw Error(`Unexpected module: ${id}`);
  } };
  vm.runInNewContext(code, context);
  return { props, api, calls, nativeDialog, render() {
    cursor = 0;
    const tree = context.module.exports[componentName](props);
    for (const node of nodes(tree)) if (node.props?.ref) node.props.ref.current = node.type === 'dialog' ? nativeDialog : { currentTime: 0, paused: true };
    while (pending.length) { const cleanup = pending.shift()(); if (cleanup) cleanups.push(cleanup); }
    return tree;
  }, unmount() { for (const cleanup of cleanups) cleanup(); } };
}

for (const [name, prop] of cases) {
  test(`${name}: native modal opens with initial focus, safe Escape and restores focus; no model starts`, () => {
    const h = renderDialog(name, prop); const tree = h.render();
    assert.equal(tree.type, 'dialog'); assert.equal(h.calls.modal, 1); assert.equal(h.calls.focus, 1);
    assert.equal(h.calls.run, 0); assert.equal(h.calls.apply, 0);
    let prevented = 0; tree.props.onCancel({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(h.calls.dismiss, 1);
    h.api.job.running = true; const running = h.render(); running.props.onCancel({ preventDefault() { prevented++; } });
    assert.equal(h.calls.dismiss, 1); assert.equal(prevented, 2); assert.equal(h.calls.modal, 1);
    const close = nodes(running).find((node) => node.type === 'button' && node.props['aria-label'] === 'close'); assert.equal(close.props.disabled, true);
    const cancel = nodes(running).find((node) => node.type === 'button' && node.props.onClick === h.api.cancel); assert.ok(cancel); cancel.props.onClick(); assert.equal(h.calls.cancel, 1);
    h.unmount(); assert.equal(h.calls.close, 1); assert.equal(h.calls.restore, 1);
  });
  test(`${name}: comparison supports keyboard, preserves media aspect and isolates editor hotkeys`, () => {
    const h = renderDialog(name, prop); let tree = h.render();
    let slider = nodes(tree).find((node) => node.props?.role === 'slider'); assert.ok(slider);
    let prevented = 0;
    slider.props.onKeyDown({ key: 'End', preventDefault() { prevented++; } }); tree = h.render();
    slider = nodes(tree).find((node) => node.props?.role === 'slider'); assert.equal(slider.props['aria-valuenow'], 100);
    slider.props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented++; } }); tree = h.render();
    slider = nodes(tree).find((node) => node.props?.role === 'slider'); assert.equal(slider.props['aria-valuenow'], 100);
    slider.props.onKeyDown({ key: 'Home', preventDefault() { prevented++; } }); tree = h.render();
    assert.equal(nodes(tree).find((node) => node.props?.role === 'slider').props['aria-valuenow'], 0);
    assert.equal(prevented, 3);
    const stage = nodes(tree).find((node) => node.props?.style?.['--repair-media-ratio']); assert.equal(stage.props.style['--repair-media-ratio'], 1080 / 1920);
    assert.ok(nodes(tree).some((node) => node.props?.className === 'repair-dialog-viewport'));
    let stopped = false; tree.props.onKeyDown({ key: ' ', stopPropagation() { stopped = true; } }); assert.equal(stopped, true);
  });
}
