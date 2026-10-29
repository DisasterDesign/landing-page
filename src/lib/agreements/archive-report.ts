import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
/** Reports must stay outside every Git checkout, including symlink aliases. */
export async function privateArchiveReportPath(requested:string):Promise<string>{
 if(!path.isAbsolute(requested))throw new Error('Private report needs an absolute path');
 const directory=await realpath(path.dirname(requested));
 let cursor=directory;
 for(;;){
  const git=await stat(path.join(cursor,'.git')).catch(()=>null);
  if(git)throw new Error('Private reports must stay outside Git checkouts');
  const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
 }
 return path.join(directory,path.basename(requested));
}
