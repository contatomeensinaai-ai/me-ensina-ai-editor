"""Build source/runtime release archives from verified official Node distributions."""
from pathlib import Path
import argparse,hashlib,json,tarfile,zipfile,tempfile,shutil
parser=argparse.ArgumentParser();parser.add_argument('--downloads',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];args.output.mkdir(parents=True,exist_ok=True)
version='0.2.0';specs={
'darwin-arm64':('node-v22.23.2-darwin-arm64.tar.gz','61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6'),
'darwin-x64':('node-v22.23.2-darwin-x64.tar.gz','58e99022c2ff89395576cc7fd4d98cea24bb68081475d5f88b801ee8729fb026'),
'win32-x64':('node-v22.23.2-win-x64.zip','1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97')}
result={'version':version,'platforms':{}}
for platform,(name,expected) in specs.items():
 archive=args.downloads/name
 assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Node integrity failure'
 with tempfile.TemporaryDirectory(prefix='meai-package-') as tmp:
  stage=Path(tmp)
  def add(rel,data,mode=0o644):
   target=stage/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);target.chmod(mode)
  if platform.startswith('win'):
   with zipfile.ZipFile(archive) as z:
    for i in z.infolist():
     rel='/'.join(i.filename.split('/')[1:])
     if rel=='node.exe':add('bin/node.exe',z.read(i))
     elif rel.startswith('node_modules/npm/') and not i.is_dir():add('lib/'+rel,z.read(i))
  else:
   with tarfile.open(archive) as t:
    for i in t.getmembers():
     rel='/'.join(i.name.split('/')[1:])
     if i.isfile() and (rel=='bin/node' or rel.startswith('lib/node_modules/npm/')):add(rel,t.extractfile(i).read(),i.mode)
  for name in ['editor-source','runtime','licenses','setup-editor.mjs','vendor-downloads.json','README.md','THIRD_PARTY.md','LICENSE']:
   src=root/name
   files=[src] if src.is_file() else list(src.rglob('*'))
   for f in files:
    if not f.is_file():continue
    rel=f.relative_to(root)
    if any(x in rel.parts for x in ['node_modules','dist','.git']):continue
    if f.suffix in ['.wasm','.tflite','.onnx','.mp3','.mp4']:raise RuntimeError('Non-source asset '+str(rel))
    if f.is_symlink():raise RuntimeError('Symlink '+str(rel))
    add(str(rel),f.read_bytes(),f.stat().st_mode & 0o777)
  package=f'Me-Ensina-AI-{version}-{platform}';out=args.output/(package+'.zip')
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for f in sorted(stage.rglob('*')):
    if f.is_file():z.write(f,package+'/'+str(f.relative_to(stage)))
  sha=hashlib.sha256(out.read_bytes()).hexdigest();out.with_suffix('.zip.sha256').write_text(sha+'  '+out.name+'\n')
  result['platforms'][platform]={'url':'https://github.com/contatomeensinaai-ai/me-ensina-ai-editor/releases/download/v0.2.0-pilot/'+out.name,'sha256':sha,'packageDirectory':package}
  print(platform,out.stat().st_size,sha,flush=True)
(args.output/'releases.json').write_text(json.dumps(result,indent=2)+'\n')
