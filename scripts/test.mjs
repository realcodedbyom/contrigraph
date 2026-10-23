import {spawnSync} from 'node:child_process';
import path from 'node:path';
const python=path.resolve('services/api/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const r=spawnSync(python,['-m','pytest','-q'],{cwd:path.resolve('services/api'),stdio:'inherit',windowsHide:true});process.exit(r.status??1);
