import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import * as captionFonts from "../lib/captionFonts.js";
import * as captionStyles from "../lib/captionStyles.js";

// Render the real ToolPanel with a small hook host. Dependencies belonging to
// other editor panels remain inert, so these interaction tests need no browser.
const code = transformSync(readFileSync(new URL("./panels.jsx", import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "automatic",
}).code;
const Dialog = () => null;
const jsx = (type, props) => ({ type, props });
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function mountPanel() {
  const slots = [];
  let index = 0;
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef(initial) { return slots[index++] ||= { current: initial }; },
    useMemo: (callback) => callback(),
    useCallback: (callback) => callback,
    useEffect() {},
  };
  const context = {
    module: { exports: {} },
    require(id) {
      if (id === "react") return hooks;
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "../lib/captionFonts.js") return captionFonts;
      if (id === "../lib/captionStyles.js") return captionStyles;
      if (id === "./CaptionStyleDialog.jsx") return { CaptionStyleDialog: Dialog };
      return new Proxy({}, { get: () => () => null });
    },
  };
  vm.runInNewContext(code, context);
  let presets = [];
  let selectedPresetId;
  const props = {
    activeTool: "caption", uiLanguage: "pt", captionStyle: { fontId: "default", textColor: "#ffffff" },
    captionSize: 24, captionSegments: [], captionStylePresets: [], captionPosition: "bottom",
    t: (key) => key, setCaptionStylePresets: (updater) => { presets = updater(presets); },
    setCaptionStylePresetId: (value) => { selectedPresetId = value; },
  };
  let tree;
  const render = () => { index = 0; tree = context.module.exports.ToolPanel(props); return tree; };
  const byClass = (className) => nodes(tree).find((node) => node.props?.className === className);
  const dialog = () => nodes(tree).find((node) => node.type === Dialog);
  render();
  return { render, byClass, dialog, get presets() { return presets; }, get selectedPresetId() { return selectedPresetId; } };
}

for (const entry of ["caption-style-save-row", "caption-save-style-button"]) {
  test(`${entry}: clicking opens the dialog before saving a named preset`, () => {
    const panel = mountPanel();
    if (entry === "caption-style-save-row") {
      panel.byClass("caption-style-library-trigger").props.onClick();
      panel.render();
    }
    assert.ok(panel.byClass(entry));
    assert.doesNotThrow(() => panel.byClass(entry).props.onClick({ type: "click" }));
    panel.render();
    assert.ok(panel.dialog(), "save entry must open CaptionStyleDialog");
    assert.equal(panel.presets.length, 0);
    panel.dialog().props.onSave("  Meu estilo da live  ");
    panel.render();
    assert.equal(panel.dialog(), undefined);
    assert.equal(panel.presets.length, 1);
    assert.equal(panel.presets[0].name, "Meu estilo da live");
    assert.equal(panel.selectedPresetId, panel.presets[0].id);
  });
}

test("save callback rejects non-string input and cancellation creates no preset", () => {
  const panel = mountPanel();
  panel.byClass("caption-save-style-button").props.onClick({ type: "click" });
  panel.render();
  for (const invalid of [null, undefined, {}, { type: "click" }, 42, "   "]) {
    assert.doesNotThrow(() => panel.dialog().props.onSave(invalid));
  }
  assert.equal(panel.presets.length, 0);
  panel.dialog().props.onCancel();
  panel.render();
  assert.equal(panel.dialog(), undefined);
  assert.equal(panel.presets.length, 0);
});
