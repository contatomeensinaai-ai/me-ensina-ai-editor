import assert from 'node:assert/strict';
import {mkdir,writeFile,readdir,readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from '../.qa/node_modules/playwright/index.mjs';
const root=process.cwd(),output=join(root,'test-output'),data=join(output,'data');await mkdir(output,{recursive:true});
const port=5219,url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['runtime/server.mjs','--port',String(port)],{cwd:root,env:{...process.env,MEAI_DATA_DIR:data},stdio:'ignore'});
let browser,page;const errors=[];
async function until(fn,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,300));}throw Error('Timed out waiting for verification');}
async function exported(ext){return until(async()=>{let files=[];try{files=await readdir(join(data,'exports'));}catch{}for(const f of files.filter(f=>f.endsWith(ext))){const p=join(data,'exports',f);if((await stat(p)).size>100)return p;}});}
try{
 await until(async()=>{try{return(await fetch(url+'/api/health')).ok;}catch{return false;}});
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByRole('button',{name:'English',exact:true}).click();
 const bytes=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle='#00aa77';ctx.fillRect(0,0,320,180);
  const stream=c.captureStream(15),ac=new AudioContext(),dest=ac.createMediaStreamDestination(),osc=ac.createOscillator(),gain=ac.createGain();gain.gain.value=.15;osc.connect(gain).connect(dest);osc.start();await ac.resume();dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),parts=[];recorder.ondataavailable=e=>parts.push(e.data);const finished=new Promise(r=>recorder.onstop=r);const draw=setInterval(()=>{ctx.fillStyle='#00aa77';ctx.fillRect(0,0,320,180);ctx.fillStyle='#ffffff';ctx.fillRect((Date.now()/20)%240,50,40,40);},60);recorder.start();await new Promise(r=>setTimeout(r,1500));recorder.stop();await finished;clearInterval(draw);stream.getTracks().forEach(t=>t.stop());await ac.close();return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
 });
 const fixture=join(output,'input.webm');await writeFile(fixture,Buffer.from(bytes));
 await page.locator('input[type=file][accept*="video/mp4"]').setInputFiles(fixture);
 await page.locator('[data-timeline-segment-track="image"]').first().waitFor({timeout:90000});
 await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('button',{name:/Export project package/}).click();
 const project=await exported('.timeline');assert((await stat(project)).size>1000);
 await page.screenshot({path:join(output,'imported.png')});
 // Reload restores the actual checkpoint from this test origin.
 await page.reload();
 const restore=page.getByRole('button',{name:/Restore|Recover|Resume/}).first();try{await restore.waitFor({timeout:5000});await restore.click();}catch{}
 await page.locator('[data-timeline-segment-track="image"]').first().waitFor({timeout:30000});
 await page.getByRole('button',{name:'Export video',exact:true}).first().click();
 await page.locator('select').filter({has:page.locator('option[value="720"]')}).selectOption('720');
 await page.getByRole('button',{name:/Start export/i}).click();
 const mp4=await exported('.mp4');const content=await readFile(mp4);assert(content.includes(Buffer.from('ftyp')));
 const info=await page.evaluate(async bytes=>{const b=new Blob([new Uint8Array(bytes)],{type:'video/mp4'});const v=document.createElement('video');v.src=URL.createObjectURL(b);await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});const ac=new AudioContext();const audio=await ac.decodeAudioData(await b.arrayBuffer());const samples=audio.getChannelData(0);const rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length);await ac.close();return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,audioRms:rms};},Array.from(content));
 assert(info.duration>1&&info.width>0&&info.audioRms>.001);await page.screenshot({path:join(output,'exported.png')});await writeFile(join(output,'result.json'),JSON.stringify({platform:process.platform,arch:process.arch,projectBytes:(await stat(project)).size,mp4Bytes:content.length,...info,errors},null,2));
 console.log(JSON.stringify({ok:true,platform:process.platform,...info}));
}catch(e){if(page){await writeFile(join(output,'page.txt'),await page.locator('body').innerText()).catch(()=>{});await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}throw e;}finally{await browser?.close();server.kill();}
