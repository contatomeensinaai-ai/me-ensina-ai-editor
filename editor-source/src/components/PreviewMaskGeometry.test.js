import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {build} from 'esbuild';
const bundle=await build({entryPoints:[new URL('./PreviewStage.jsx',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'browser',packages:'external',jsx:'automatic',define:{'import.meta.url':JSON.stringify(import.meta.url),'import.meta.env':'{}'},plugins:[{name:'urls',setup(b){b.onResolve({filter:/\?(?:url|worker)/},a=>({path:a.path,namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},()=>({contents:'export default "test-url"'}));}}]});
const jsx=(type,props)=>({type,props});
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
function render(extra={}){
 const events={};const ctx=vm.createContext({module:{exports:{}},console,URL,Blob,Map,Set,WeakMap,window:{devicePixelRatio:1,addEventListener:(key,fn)=>events[key]=fn,removeEventListener:()=>{}},require(id){if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};if(id==='react')return{memo:fn=>fn,useRef:v=>({current:v}),useState:v=>[v,()=>{}],useMemo:fn=>fn(),useEffect:()=>{},Fragment:'fragment'};if(id==='react-dom')return{createPortal:n=>n};return new Proxy({},{get:(_,key)=>String(key)});}});
 vm.runInContext(bundle.outputFiles[0].text,ctx);
 const frame={getBoundingClientRect:()=>({left:0,top:0,width:1080,height:1920})};
 const props={t:k=>k,previewShellRef:{current:null},previewCanvasRef:{current:frame},previewVideoRef:{current:null},previewVisualSrc:'local.png',previewVisualType:'image',previewRatio:'9 / 16',previewFrameStyle:{},previewFrameSize:{width:1080,height:1920},trackVisibility:{image:true,caption:false},selectedFilter:{css:'none'},fitMode:'contain',captionsEnabled:false,currentTime:3,estimatedDuration:5,visualEffects:{width:1080,height:1920,mask:{type:'circle',size:72},supportingLayout:{version:1,windows:[{start:2,end:4,topRatio:.4}]}},visualMaskEditable:true,...extra};
 return{tree:ctx.module.exports.PreviewStage(props),events,props};
}
test('actual PreviewStage draws round mask and editor handle in the lower split viewport',()=>{
 let patch;const h=render({onUpdateVisualMask:value=>patch=value});const all=nodes(h.tree);
 const media=all.find(n=>n.props?.className?.startsWith('visual-media-layer'));
 const svg=decodeURIComponent(media.props.style.maskImage);assert.ok(svg.includes('height="1152"'));assert.ok(svg.includes('r="388.8"'));
 const editor=all.find(n=>n.props?.className==='visual-mask-editor is-circle');
 assert.equal(editor.props.style.width,editor.props.style.height);assert.equal(parseFloat(editor.props.style.top)+parseFloat(editor.props.style.height)/2,1344);
 editor.props.onPointerDown({clientX:540,clientY:1344,preventDefault(){},stopPropagation(){}});
 h.events.pointermove({clientX:540,clientY:1401.6});assert.ok(Math.abs(patch.centerY-55)<1e-9);
});
test('support image solid mask stays in upper viewport and preserves content transform independently',()=>{
 const overlay={id:'support',type:'image',src:'local.png',width:1080,height:1080,start:0,duration:5,baseTransform:{scale:1.2,x:10,y:20,rotation:15,opacity:.5},mask:{type:'circle',size:50},supportingLayout:{role:'image',topRatio:.4}};
 const h=render({visualOverlays:[overlay],selectedVisualOverlayId:'support',visualOverlayMaskEditable:true});const all=nodes(h.tree);
 const outer=all.find(n=>n.props?.className?.startsWith('visual-overlay-layer'));assert.equal(outer.props.style.height,'40%');assert.equal(outer.props.style.transform,'none');
 const masked=nodes(outer).find(n=>n.props?.style?.maskImage);const svg=decodeURIComponent(masked.props.style.maskImage);assert.ok(svg.includes('height="768"'));assert.ok(svg.includes('r="192"'));
 const content=all.find(n=>n.props?.className==='visual-overlay-content');assert.equal(content.props.style.opacity,.5);assert.match(content.props.style.transform,/translate\(10%, 20%\)/);
 const editor=nodes(outer).find(n=>n.props?.className==='visual-mask-editor is-circle');assert.equal(editor.props.style.width,editor.props.style.height);
});
