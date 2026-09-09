import test from 'node:test';
import assert from 'node:assert/strict';
import {saveLocalArtifact} from './localArtifactSave.js';

const validReceipt={path:'/workspace/exports/movie.mp4',fileName:'movie.mp4',bytes:5,sha256:'a'.repeat(64),verified:true};
function transport(receipt=validReceipt,status=201){
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return url.endsWith('/session')?Response.json({capability:'b'.repeat(64)}):Response.json(receipt,{status});};
  return {fetchImpl,calls};
}
test('posts original binary Blob with session capability and returns only verified receipt',async()=>{
  const {fetchImpl,calls}=transport();const blob=new Blob(['video']);
  const receipt=await saveLocalArtifact(blob,'movie.mp4',{fetchImpl,language:'es'});
  assert.deepEqual(receipt,validReceipt);
  assert.equal(calls[1].options.body,blob);
  assert.equal(calls[1].options.headers['content-type'],'video/mp4');
  assert.equal(calls[1].options.headers['x-timeline-capability'],'b'.repeat(64));
  assert.equal(calls[1].options.headers['x-timeline-language'],'es');
});
test('rejects false or corrupted receipts, localized errors and preserves cancellation',async()=>{
  for(const invalid of [{...validReceipt,verified:false},{...validReceipt,bytes:3},{...validReceipt,sha256:'bad'},{...validReceipt,path:'elsewhere'}]){
    await assert.rejects(saveLocalArtifact(new Blob(['video']),'movie.mp4',{...transport(invalid),language:'en'}),/intact file/);
  }
  await assert.rejects(saveLocalArtifact(new Blob(['video']),'movie.mp4',{...transport({code:'busy'},409),language:'es'}),/guardando/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(saveLocalArtifact(new Blob(['video']),'movie.mp4',{signal:controller.signal,fetchImpl:async()=>{throw controller.signal.reason;}}),{name:'AbortError'});
});
test('Windows drive receipt remains verified and relative or mismatched receipts are rejected',async()=>{
  for(const path of ['C:\\Users\\Test User\\exports\\movie.mp4','C:/Users/Test User/exports/movie.mp4']){
    const receipt={...validReceipt,path};
    assert.deepEqual(await saveLocalArtifact(new Blob(['video']),'movie.mp4',transport(receipt)),receipt);
  }
  for(const path of ['C:movie.mp4','\\\\server\\share\\movie.mp4','C:\\exports\\other.mp4','C:\\exports\\..\\movie.mp4']){
    await assert.rejects(saveLocalArtifact(new Blob(['video']),'movie.mp4',{...transport({...validReceipt,path}),language:'en'}),/intact file/);
  }
});
