import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import {FEATURE_COPY} from "../i18nFeatureCopy.js";
import * as highlights from "../lib/captionHighlights.js";

const code = transformSync(readFileSync(new URL("./CaptionKeywordsPanel.jsx", import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "automatic",
}).code;
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

test("editable keyword controls apply only to selected caption or explicitly to all; blank clears", () => {
  const states = [];
  let index;
  let segments = [
    { id: "one", text: "Use Codex com IA", start: 0, end: 2, fontId: "poppins", styleOverrides: { backgroundOpacity: 0.22 } },
    { id: "two", text: "Nesta segunda live", start: 2, end: 4 },
  ];
  const original = structuredClone(segments);
  const jsx = (type, props) => ({ type, props });
  const context = {
    module: { exports: {} },
    require(id) {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "react") return { useEffect() {}, useRef() { const slot = index++; return states[slot] ??= {current:null}; }, useState(initial) {
        const slot = index++;
        if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
        return [states[slot], (value) => { states[slot] = value; }];
      } };
      if (id.endsWith(".css")) return {};
      return highlights;
    },
  };
  vm.runInNewContext(code, context);
  const render = () => {
    index = 0;
    return context.module.exports.CaptionKeywordsPanel({
      t: key => FEATURE_COPY.pt[key], language: "pt",
      selectedCaptionSegment: segments[0], captionSegments: segments,
      setCaptionSegments: (update) => { segments = update(segments); },
    });
  };
  let tree = render();
  nodes(tree).find((node) => node.type === "textarea").props.onChange({ target: { value: "Codex, IA, live" } });
  nodes(tree).find((node) => node.type === "input").props.onChange({ target: { value: "#f5a623" } });
  tree = render();
  nodes(tree).find((node) => node.type === "button" && node.props.children === "Aplicar neste trecho").props.onClick();
  assert.deepEqual(segments[0].highlightWords, ["Codex", "IA", "live"]);
  assert.equal(segments[0].highlightColor, "#f5a623");
  assert.deepEqual(segments[1], original[1]);
  assert.equal(segments[0].fontId, original[0].fontId);
  assert.deepEqual(segments[0].styleOverrides, original[0].styleOverrides);
  tree = render();
  nodes(tree).find((node) => node.type === "button" && node.props.children === "Aplicar em todos").props.onClick();
  assert.deepEqual(segments[1].highlightWords, ["Codex", "IA", "live"]);
  nodes(tree).find((node) => node.type === "textarea").props.onChange({ target: { value: "" } });
  tree = render();
  nodes(tree).find((node) => node.type === "button" && node.props.children === "Aplicar neste trecho").props.onClick();
  assert.deepEqual(segments[0].highlightWords, []);
  assert.deepEqual(segments[1].highlightWords, ["Codex", "IA", "live"]);
});
