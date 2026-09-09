import test from 'node:test';import assert from 'node:assert/strict';
import {createAssetDragControls} from './assetDragControls.js';
test('desktop sticker click inserts selected asset once; mobile waits for explicit confirmation',()=>{
 const previous=globalThis.window;let mobile=false;const additions=[];let selected;
 globalThis.window={matchMedia:()=>({matches:mobile})};
 try{
 const controls=createAssetDragControls({suppressAssetClickRef:{current:''},currentTime:2,setSelectedStickerId:id=>selected=id,addStickerAssetToTimeline:(asset,opts)=>additions.push({asset,opts})});
 const sticker={id:'synthetic',src:'local.png'};controls.handleStickerClick({},sticker);
 assert.equal(selected,sticker.id);assert.equal(additions.length,1);assert.equal(additions[0].opts.startTime,2);
 mobile=true;controls.handleStickerClick({},sticker);assert.equal(additions.length,1);
 controls.confirmStickerSelection(sticker);assert.equal(additions.length,2);
 }finally{globalThis.window=previous;}
});
