import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const modelId = "onnx-community/whisper-small_timestamped";
const revision = "65caa70f294b46e1c33ff820aae6b16d048ab818";
const output = { text: "Olá mundo", chunks: [
  { text: " Olá", timestamp: [0.1, 0.32] }, { text: " mundo", timestamp: [0.36, 0.86] },
] };

async function bundled(entry, format = "iife") {
  const result = await build({
    entryPoints: [new URL(entry, import.meta.url).pathname], bundle: true, write: false,
    platform: "browser", format,
    // No worker is instantiated in the main-thread-fallback test.
    define: { "import.meta.url": JSON.stringify(new URL(entry, import.meta.url).href) },
    plugins: [{ name: "offline-asr-contract", setup(builder) {
      builder.onResolve({ filter: /^@huggingface\/transformers$/ }, () => ({ path: "mock", namespace: "offline-asr" }));
      builder.onLoad({ filter: /.*/, namespace: "offline-asr" }, () => ({
        contents: "export const env = {}; export const pipeline = (...args) => globalThis.testPipeline(...args);",
      }));
    } }],
  });
  return result.outputFiles[0].text;
}

function mockedPipeline(calls, chunks = output) {
  return async (task, model, options) => {
    calls.push({ task, model, options });
    const transcriber = async (_audio, settings) => { calls.push({ settings }); return chunks; };
    transcriber.model = { generation_config: { is_multilingual: false } };
    return transcriber;
  };
}

test("actual worker forwards word mode and uses pinned timestamp-capable model without eager loading", async () => {
  let listener;
  let resolveResult;
  const completed = new Promise((resolve) => { resolveResult = resolve; });
  const calls = [];
  const context = vm.createContext({
    Float32Array, console,
    testPipeline: mockedPipeline(calls),
    self: {
      addEventListener: (_type, callback) => { listener = callback; },
      postMessage: (message) => { if (["result", "error"].includes(message.type)) resolveResult(message); },
    },
  });
  vm.runInContext(await bundled("../workers/asr.worker.js"), context);
  assert.equal(calls.length, 0);
  listener({ data: { type: "transcribe", requestId: "test", audioBuffer: new Float32Array(16000).buffer, preferredLanguage: "pt", wordTimestamps: true } });
  const response = await completed;
  assert.equal(response.type, "result");
  assert.equal(calls[0].model, modelId);
  assert.equal(calls[0].options.revision, revision);
  assert.equal(calls[0].options.dtype, "q8");
  assert.equal(calls[0].options.device, "wasm");
  assert.equal(calls[1].settings.return_timestamps, "word");
  assert.deepEqual(JSON.parse(JSON.stringify(response.output)), output);
});

test("actual main-thread fallback uses the same pinned model and preserves aligned words", async () => {
  const calls = [];
  const context = vm.createContext({
    module: { exports: {} },
    console: { warn() {}, error() {} },
    Float32Array, Map, Set,
    testPipeline: mockedPipeline(calls),
    window: { AudioContext: class {
      async decodeAudioData() { return { numberOfChannels: 1, duration: 1, getChannelData: () => new Float32Array(16000) }; }
      async close() {}
    } },
  });
  vm.runInContext(await bundled("./asr.js", "cjs"), context);
  assert.equal(calls.length, 0);
  const result = await context.module.exports.transcribeAudioToCaptionSegments(new Blob(["audio"]), { preferredLanguage: "pt", portraitCaptions: true });
  assert.equal(calls[0].model, modelId);
  assert.equal(calls[0].options.revision, revision);
  assert.equal(calls[1].settings.return_timestamps, "word");
  assert.equal(result.segments[0].start, 0.1);
  assert.equal(result.segments[0].end, 0.86);
  assert.equal(result.segments[0].words.length, 2);
});

test('actual worker never passes a long recording into Transformers internal overlapping chunk merge',async()=>{
 let listener,done;const complete=new Promise(resolve=>done=resolve);const lengths=[];const settings=[];
 const context=vm.createContext({Float32Array,console,testPipeline:async()=>{const transcriber=async(audio,options)=>{lengths.push(audio.length/16000);settings.push(options);return {text:' Olá',chunks:[{text:' Olá',timestamp:[.1,.5]}]};};transcriber.model={generation_config:{is_multilingual:false}};return transcriber;},self:{addEventListener:(_type,callback)=>listener=callback,postMessage:message=>{if(['result','error'].includes(message.type))done(message);}}});
 vm.runInContext(await bundled('../workers/asr.worker.js'),context);
 listener({data:{type:'transcribe',requestId:'long',audioBuffer:new Float32Array(58*16000).fill(.05).buffer,preferredLanguage:'pt',wordTimestamps:true}});
 const result=await complete;assert.equal(result.type,'result');assert.ok(lengths.length>=3);assert.ok(lengths.every(seconds=>seconds<=24.001),JSON.stringify(lengths));assert.ok(settings.every(options=>!options.chunk_length_s&&!options.stride_length_s));
});
