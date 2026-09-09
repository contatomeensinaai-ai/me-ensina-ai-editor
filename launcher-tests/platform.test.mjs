import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDataDirectory,samePath,codexEnvironment} from '../runtime/runtime-config.mjs';
import {launcherDataDirectory,codexCandidates,browserCommand} from '../launcher/platform.mjs';
import {setupEnvironment,isMainModule} from '../setup-editor.mjs';
import {isAbsoluteArtifactPath} from '../editor-source/src/lib/localArtifactSave.js';
test('Windows paths preserve drives, spaces and use LocalAppData',()=>{
 const env={LOCALAPPDATA:'C:\\Users\\Example User\\AppData\\Local'};
 const expected='C:\\Users\\Example User\\AppData\\Local\\Me Ensina AI';
 assert.equal(runtimeDataDirectory(env,'C:\\Users\\Example User','win32'),expected);
 assert.equal(launcherDataDirectory(env,'C:\\Users\\Example User','win32'),expected);
 assert.equal(runtimeDataDirectory({},'/Users/test','darwin'),'/Users/test/Library/Application Support/Me Ensina AI');
 assert.throws(()=>runtimeDataDirectory({MEAI_DATA_DIR:'C:relative'},'C:\\Users\\test','win32'));
 assert.equal(samePath('C:\\Data\\Editor','c:\\data\\editor','win32'),true);
 assert.equal(samePath('\\\\?\\C:\\Data\\Editor','c:\\data\\editor','win32'),true);
 assert.equal(samePath('C:\\Data\\Editor','C:\\Elsewhere\\Editor','win32'),false);
 assert.equal(samePath('/Data','/data','darwin'),false);
});
test('Windows CLI discovery produces only native executable candidates and never shell shims',()=>{
 const list=codexCandidates({env:{Path:'C:\\Tools;C:\\Program Files\\CLI',LOCALAPPDATA:'C:\\Users\\test\\AppData\\Local'},home:'C:\\Users\\test',platform:'win32'});
 assert.ok(list.includes('C:\\Tools\\codex.exe'));
 assert.ok(list.every(p=>p.endsWith('.exe')));
 assert.ok(!list.some(p=>/cmd\.exe|powershell|\.cmd$/i.test(p)));
 const command=browserCommand('http://127.0.0.1:5201/',{SystemRoot:'C:\\Windows'},'win32');
 assert.equal(command.command,'C:\\Windows\\System32\\rundll32.exe');
 assert.deepEqual(command.args,['url.dll,FileProtocolHandler','http://127.0.0.1:5201/']);
});
test('setup and CLI environment retain Windows essential directories without copying arbitrary secrets',()=>{
 const env={Path:'C:\\Windows;C:\\Tools',SystemRoot:'C:\\Windows',USERPROFILE:'C:\\Users\\test',LOCALAPPDATA:'C:\\Local',TEMP:'C:\\Temp',SECRET_TEST:'hidden'};
 const prepared=setupEnvironment(env,'C:\\App\\bin\\node.exe','win32');
 assert.equal(prepared.PATH,'C:\\App\\bin;C:\\Windows;C:\\Tools');assert.equal(prepared.Path,undefined);
 const clean=codexEnvironment(env,'win32');assert.equal(clean.SystemRoot,'C:\\Windows');assert.equal(clean.USERPROFILE,'C:\\Users\\test');assert.equal(clean.SECRET_TEST,undefined);
 assert.equal(isMainModule('file:///C:/App/setup-editor.mjs','c:\\app\\setup-editor.mjs','win32'),true);
});
test('artifact receipt accepts absolute native paths with correct final filename only',()=>{
 for(const path of ['/tmp/exports/clip.srt','C:\\Users\\test\\exports\\clip.srt','C:/Users/test/exports/clip.srt'])assert.equal(isAbsoluteArtifactPath(path,'clip.srt'),true,path);
 for(const path of ['clip.srt','C:clip.srt','\\\\server\\share\\clip.srt','C:\\folder\\other.srt','/tmp/other.srt','/tmp/../clip.srt'])assert.equal(isAbsoluteArtifactPath(path,'clip.srt'),false,path);
});
