import { groupTimedCaptionWords } from './captionSegmentation.js';
export const ASR_WINDOW_SAMPLE_RATE = 16000;
export const ASR_MAX_WINDOW_SECONDS = 24;
const CONTEXT_SECONDS = .35;
const CORE_SECONDS = ASR_MAX_WINDOW_SECONDS - CONTEXT_SECONDS * 2;

function alignmentError(message) {
  return Object.assign(new Error(message), {code:'CAPTION_WORD_ALIGNMENT_REQUIRED'});
}
function quietIntervals(audio, sampleRate) {
  const frame = Math.max(1, Math.round(sampleRate * .01));
  const energy=[];
  for(let i=0;i<audio.length;i+=frame){let sum=0;const n=Math.min(frame,audio.length-i);for(let j=0;j<n;j++)sum+=audio[i+j]**2;energy.push(Math.sqrt(sum/n));}
  const sorted=[...energy].sort((a,b)=>a-b);
  const threshold=Math.min(.02,(sorted[Math.floor(sorted.length*.9)]||0)*.15);
  const intervals=[];let start=null;
  for(let i=0;i<=energy.length;i++){
    if(i<energy.length&&energy[i]<=threshold){start??=i*.01;}
    else if(start!==null){if(i*.01-start>=.12)intervals.push({start,end:Math.min(audio.length/sampleRate,i*.01)});start=null;}
  }
  return intervals;
}
function chooseBoundary(quiet, lower, upper, target) {
  const candidates=quiet.filter(q=>q.end>=lower&&q.start<=upper).map(q=>({
    time:Math.max(lower,Math.min(upper,(q.start+q.end)/2)),
    score:q.end-q.start,
  }));
  candidates.sort((a,b)=>b.score-a.score||Math.abs(a.time-target)-Math.abs(b.time-target));
  return candidates[0]?{time:candidates[0].time,quiet:true}:{time:target,quiet:false};
}
export function planAsrWindows(audio,{sampleRate=ASR_WINDOW_SAMPLE_RATE}={}) {
  const duration=audio.length/sampleRate;
  if(!duration)return[];
  const quiet=quietIntervals(audio,sampleRate),windows=[];let start=0,previousQuiet=true;
  while(start<duration){
    const boundary=duration-start<=CORE_SECONDS?{time:duration,quiet:true}:chooseBoundary(quiet,start+14,Math.min(duration,start+CORE_SECONDS),Math.min(duration,start+20));
    const coreEnd=Math.round(boundary.time*sampleRate)/sampleRate;
    // At an acoustic pause, each side already contains real silence context.
    // Sharing that silence makes Whisper extend the first word backwards over
    // the preceding window's final word. Only speech boundaries need overlap.
    windows.push({coreStart:start,coreEnd,start:Math.max(0,start-(previousQuiet?0:CONTEXT_SECONDS)),end:Math.min(duration,coreEnd+(boundary.quiet?0:CONTEXT_SECONDS))});
    start=coreEnd;previousQuiet=boundary.quiet;
  }
  return windows;
}
function token(text){return String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
function normalizeWords(output,window,duration,language) {
  let previousEnd=-Infinity;
  const chunks=(output?.chunks||[]).filter(c=>String(c?.text??'').trim()).map(chunk=>{
    // A dialogue dash is punctuation, not a second spoken word. Preserve the
    // model's single time interval; never apportion phrase timing to letters.
    const text=String(chunk.text).replace(/^(\s*)[-–—]\s+(?=\p{L})/u,'$1');
    const [start,end]=chunk.timestamp||[];
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||end>window.end-window.start+.05||start<previousEnd-.000001)throw alignmentError('Invalid word timestamps in a short ASR window.');
    previousEnd=end;
    return {...chunk,text,timestamp:[start+window.start,end+window.start]};
  });
  if(!chunks.length) return [];
  // Keep the same strict word contract used by the caption writer.
  groupTimedCaptionWords({chunks},{duration,language});
  return chunks;
}
const midpoint=c=>(c.timestamp[0]+c.timestamp[1])/2;
export function mergeAsrWindowWords(results) {
  let merged=[];
  for(const {window,chunks}of results){
    if(!merged.length){merged=chunks;continue;}
    const boundary=window.coreStart;
    let anchor=null;
    // Match overlap by both literal words and real times. A legitimate repeated
    // word elsewhere in the recording is never removed by text alone.
    for(let i=0;i<merged.length;i++){
      if(midpoint(merged[i])<window.start-.1)continue;
      for(let j=0;j<chunks.length&&midpoint(chunks[j])<=boundary+CONTEXT_SECONDS+.6;j++){
        let length=0;
        while(merged[i+length]&&chunks[j+length]&&token(merged[i+length].text)&&token(merged[i+length].text)===token(chunks[j+length].text)&&Math.abs(midpoint(merged[i+length])-midpoint(chunks[j+length]))<=.45)length++;
        const distance=Math.abs(midpoint(merged[i])-midpoint(chunks[j]));
        if(length&&(!anchor||length>anchor.length||(length===anchor.length&&distance<anchor.distance)))anchor={i,j,length,distance};
      }
    }
    if(anchor){const offset=Math.floor((anchor.length-1)/2);merged=[...merged.slice(0,anchor.i+offset+1),...chunks.slice(anchor.j+offset+1)];}
    else if(!chunks.length||merged.at(-1).timestamp[1]<=chunks[0].timestamp[0]+.000001)merged=[...merged,...chunks];
    // A midpoint filter would silently discard unmatched words at a speech
    // boundary. Reject ambiguous overlap instead of dropping or retiming them.
    else throw alignmentError('Unmatched words overlap at an ASR window boundary.');
    for(let i=1;i<merged.length;i++)if(merged[i].timestamp[0]<merged[i-1].timestamp[1]-.000001)throw alignmentError('Conflicting real word times at an ASR window boundary.');
  }
  return merged;
}

/** Shared by the browser worker and its WASM main-thread fallback. No internal
 * Transformers long-audio merge, repeat suppression or estimated word timing. */
export async function transcribeInShortWindows(transcriber,audio,options={}, {onProgress,onWindow}={}) {
  const duration=audio.length/ASR_WINDOW_SAMPLE_RATE;
  const wordMode=options.return_timestamps==='word';
  const baseOptions={...options,max_new_tokens:448};
  delete baseOptions.chunk_length_s;delete baseOptions.stride_length_s;delete baseOptions.no_repeat_ngram_size;delete baseOptions.repetition_penalty;
  if(duration<=ASR_MAX_WINDOW_SECONDS){
    const output=await transcriber(audio,baseOptions);
    if(!wordMode)return output;
    return {...output,chunks:normalizeWords(output,{start:0,end:duration},duration,options.language)};
  }
  const windows=planAsrWindows(audio),results=[];
  for(let i=0;i<windows.length;i++){
    const window=windows[i];
    const input=audio.slice(Math.round(window.start*ASR_WINDOW_SAMPLE_RATE),Math.round(window.end*ASR_WINDOW_SAMPLE_RATE));
    const output=await transcriber(input,{...baseOptions,return_timestamps:'word'});
    onWindow?.({window,output});
    const chunks=normalizeWords(output,window,duration,options.language);
    results.push({window,chunks});onProgress?.((i+1)/windows.length);
  }
  const chunks=mergeAsrWindowWords(results);
  groupTimedCaptionWords({chunks},{duration,language:options.language||'pt'});
  const output={text:chunks.map(c=>c.text).join(''),chunks};
  if(wordMode)return output;
  return {...output,chunks:groupTimedCaptionWords(output,{duration,language:options.language||'pt'}).map(c=>({text:` ${c.text}`,timestamp:[c.start,c.end]}))};
}
