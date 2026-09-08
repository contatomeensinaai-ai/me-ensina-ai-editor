import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

// Exercise the component's event handlers without launching the user's editor.
// Native dialog focus containment still needs the integrated browser QA pass.
const source = readFileSync(new URL("./CaptionStyleDialog.jsx", import.meta.url), "utf8");
const code = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" }).code;

function mount() {
  let name;
  let stateInitialized = false;
  let effect;
  let refs = [];
  let refIndex = 0;
  const saved = [];
  let canceled = 0;
  let focusReturned = 0;
  const jsx = (type, props) => ({ type, props });
  const context = {
    module: { exports: {} },
    require: (id) => {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id.endsWith(".css")) return {};
      assert.equal(id, "react");
      return {
        useState: (initial) => {
          if (!stateInitialized) { name = initial(); stateInitialized = true; }
          return [name, (value) => { name = value; }];
        },
        useRef: () => refs[refIndex++] ||= { current: null },
        useEffect: (callback) => { effect = callback; },
        useId: () => "caption-style-title",
      };
    },
  };
  vm.runInNewContext(code, context);
  const props = {
    t: (key) => key === "captionStyleUntitled" ? "Meu estilo" : key,
    onSave: (value) => saved.push(value),
    onCancel: () => { canceled += 1; },
    returnFocusRef: { current: { focus: () => { focusReturned += 1; } } },
  };
  const render = () => { refIndex = 0; return context.module.exports.CaptionStyleDialog(props); };
  return { render, saved, get canceled() { return canceled; }, get focusReturned() { return focusReturned; }, runEffect: () => effect() };
}

function elements(tree) {
  return [tree, ...[tree.props?.children].flat().filter((child) => child && typeof child === "object").flatMap(elements)];
}

test("named modal opens, selects its initial name and restores focus on close", () => {
  const harness = mount();
  const tree = harness.render();
  const input = elements(tree).find((node) => node.type === "input");
  const calls = [];
  tree.props.ref.current = { showModal: () => calls.push("open"), close: () => calls.push("close") };
  input.props.ref.current = { select: () => calls.push("select") };
  const cleanup = harness.runEffect();
  assert.deepEqual(calls, ["open", "select"]);
  assert.equal(tree.type, "dialog");
  assert.equal(tree.props["aria-modal"], "true");
  assert.equal(elements(tree).find((node) => node.type === "label").props.id, tree.props["aria-labelledby"]);
  assert.equal(input.props.value, "Meu estilo");
  cleanup();
  assert.deepEqual(calls, ["open", "select", "close"]);
  assert.equal(harness.focusReturned, 1);
});

test("saving trims the name and rejects whitespace without creating a preset", () => {
  const harness = mount();
  let tree = harness.render();
  const edit = (value) => {
    elements(tree).find((node) => node.type === "input").props.onChange({ target: { value } });
    tree = harness.render();
  };
  const submit = () => elements(tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  edit("   ");
  assert.equal(elements(tree).find((node) => node.props.type === "submit").props.disabled, true);
  submit();
  assert.deepEqual(harness.saved, []);
  edit("  Legenda da live  ");
  submit();
  assert.deepEqual(harness.saved, ["Legenda da live"]);
});

test("Cancel and Escape cancel without saving; editor shortcuts do not receive keys", () => {
  const harness = mount();
  const tree = harness.render();
  elements(tree).find((node) => node.type === "button" && node.props.type === "button").props.onClick();
  let prevented = false;
  tree.props.onCancel({ preventDefault() { prevented = true; } });
  let stopped = false;
  tree.props.onKeyDown({ stopPropagation() { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(harness.canceled, 2);
  assert.deepEqual(harness.saved, []);
});
