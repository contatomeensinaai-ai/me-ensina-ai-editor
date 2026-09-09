import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {composeColorGradeFilter,resolveColorGrade} from './colorGrade.js';

const bundled=await build({entryPoints:[new URL('./media.js',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'browser',packages:'external',define:{'import.meta.url':JSON.stringify(import.meta.url),'import.meta.env':'{}'},plugins:[{name:'asset-urls',setup(b){b.onResolve({filter:/\?(?:url|worker)/},args=>({path:args.path,namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},()=>({contents:'export default "local-test-url";'}));}}]});
function recorder(){
 const calls=[];let count=0;
 function canvas(name,width=400,height=500){
  const surface={name,width,height};let state={globalAlpha:1,filter:'none',globalCompositeOperation:'source-over'},stack=[];
  const methods={save(){stack.push({...state});},restore(){state=stack.pop()||state;},measureText(){return{width:0};},drawImage(source,...args){calls.push({op:'drawImage',target:name,source:source.name,args,state:{...state}});}};
  const context=new Proxy(methods,{get(target,key){if(key==='canvas')return surface;if(key in target)return target[key];if(key in state)return state[key];return(...args)=>{calls.push({op:key,target:name,args,state:{...state}});};},set(_t,key,value){state[key]=value;return true;}});
  surface.getContext=()=>context;return surface;
 }
 const context=vm.createContext({module:{exports:{}},console,Blob,URL,Map,WeakMap,Set,Math,document:{createElement:()=>canvas(`layer-${count++}`)},require:()=>new Proxy({},{get:()=>()=>{}})});
 vm.runInContext(bundled.outputFiles[0].text,context);
 const output=canvas('output');
 function draw(overlay,options={}){calls.length=0;context.module.exports.drawPreviewFrame(output.getContext(),{name:'base',width:400,height:500},output,{captionsEnabled:false,visualTime:1,timelineTime:11,visualOverlays:[overlay],visualOverlaySources:[{name:'support-image',width:300,height:300}],...options});return calls;}
 return{draw,calls};
}
const supporting={start:0,duration:4,type:'image',supportingLayout:{role:'image',topRatio:0.4,imagePosition:{x:1,y:0}},baseTransform:{x:10,y:20,scale:1.2,rotation:15,opacity:0.6},filterId:'effect-noir',colorGrade:{saturation:40},animation:{in:{id:'fade',duration:2}}};
test('supporting image uses common filter/color/opacity/animation pipeline and region-relative transforms',()=>{
 const {draw}=recorder();const calls=draw(supporting);const image=calls.find(call=>call.op==='drawImage'&&call.source==='support-image');
 assert.equal(image.state.globalAlpha,0.6*0.875);
 assert.equal(image.state.filter,composeColorGradeFilter('grayscale(1) contrast(1.18)',resolveColorGrade([],1,supporting.colorGrade)));
 assert.ok(calls.some(call=>call.op==='translate'&&call.args[0]===240&&call.args[1]===140));
 assert.deepEqual(image.args,[200,0,200,200]);
 assert.ok(calls.some(call=>call.op==='rect'&&call.args.join(',')==='0,0,400,200'));
});
test('supporting solid/feathered/inverted masks use fixed local viewport independent of image transform',()=>{
 for(const mask of [{type:'circle',size:50,centerX:10,centerY:50},{type:'rounded',width:50,height:80,cornerRadius:20,feather:10,inverted:true}]){
  const {draw}=recorder();const calls=draw({...supporting,mask});
  assert.ok(calls.some(call=>call.op==='drawImage'&&call.state.globalCompositeOperation==='destination-in'));
  if(mask.type==='circle')assert.ok(calls.some(call=>call.op==='arc'&&call.args[0]===40&&call.args[1]===100&&call.args[2]===50));
  else assert.ok(calls.some(call=>call.op==='fill'&&call.state.globalCompositeOperation==='destination-out'&&call.state.filter.startsWith('blur(')));
 }
});
test('animation and keyframe times remain relative to overlay, including across base-clip changes',()=>{
 const {draw}=recorder();const overlay={...supporting,duration:20,baseTransform:{opacity:1},keyframes:[{time:0,opacity:0.2},{time:2,opacity:0.6}],start:-8};
 const a=draw(overlay,{visualTime:1,timelineTime:11}).find(call=>call.op==='drawImage'&&call.source==='support-image').state.globalAlpha;
 const b=draw({...overlay,start:2},{visualTime:11,timelineTime:11}).find(call=>call.op==='drawImage'&&call.source==='support-image').state.globalAlpha;
 assert.equal(a,b);assert.equal(a,0.6);
});
test('ordinary overlays retain full-frame contain positioning and animated mask path',()=>{
 const {draw}=recorder();const calls=draw({...supporting,supportingLayout:undefined,mask:{type:'circle',size:50}});
 assert.ok(calls.some(call=>call.op==='arc'&&call.args[0]===200&&call.args[1]===250&&call.args[2]===100));
 assert.ok(calls.some(call=>call.op==='translate'&&call.target.startsWith('layer')&&call.args[0]===240&&call.args[1]===350));
});

// Native pixels are optional in other checkouts; command-level rendering tests above always run.
let nativeCanvas;
try {
 const require=createRequire(import.meta.url);
 nativeCanvas=require(require.resolve('@napi-rs/canvas',{paths:[process.env.TIMELINE_TEST_RUNTIME_MODULES].filter(Boolean)}));
} catch { /* No dependency is installed or downloaded by this test. */ }
test('native pixels preserve fixed supporting mask, inversion, opacity and lower video region', {skip:!nativeCanvas && 'Native canvas unavailable; run with TIMELINE_TEST_RUNTIME_MODULES pointing to an installed runtime'},()=>{
 const {createCanvas}=nativeCanvas;
 const context=vm.createContext({module:{exports:{}},console,Blob,URL,Map,WeakMap,Set,Math,document:{createElement:()=>createCanvas(400,500)},require:()=>new Proxy({},{get:()=>()=>{}})});
 vm.runInContext(bundled.outputFiles[0].text,context);
 const output=createCanvas(400,500),base=createCanvas(400,500),image=createCanvas(400,200);
 base.getContext('2d').fillStyle='#0000ff';base.getContext('2d').fillRect(0,0,400,500);
 image.getContext('2d').fillStyle='#ff0000';image.getContext('2d').fillRect(0,0,400,200);
 const paint=(inverted=false,opacity=1)=>{
  context.module.exports.drawPreviewFrame(output.getContext('2d'),base,output,{captionsEnabled:false,visualTime:1,visualOverlays:[{start:0,duration:4,type:'image',baseTransform:{opacity},mask:{type:'circle',size:50,inverted},supportingLayout:{role:'image',topRatio:0.4,imagePosition:{x:0.5,y:0.5}}}],visualOverlaySources:[image]});
  return(x,y)=>Array.from(output.getContext('2d').getImageData(x,y,1,1).data);
 };
 let pixel=paint();
 assert.deepEqual(pixel(200,100),[255,0,0,255]);
 assert.deepEqual(pixel(20,20),[9,11,15,255]);
 assert.deepEqual(pixel(200,300),[0,0,255,255]);
 pixel=paint(true);
 assert.deepEqual(pixel(200,100),[9,11,15,255]);
 assert.deepEqual(pixel(20,20),[255,0,0,255]);
 pixel=paint(false,0.5);
 assert.ok(Math.abs(pixel(200,100)[0]-132)<=1);
 assert.deepEqual(pixel(200,300),[0,0,255,255]);
});
