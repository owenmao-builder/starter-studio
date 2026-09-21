import {Archive,ArrowRight,FileText,FolderOpen,History,Plus,Route,RotateCcw} from 'lucide-react';
import {stepIndex,workflowSteps,type Project} from '@/lib/types';
import type {StudioView} from '@/lib/navigation';

export default function ProjectLibrary({projects,mode,currentId,busy,preview,onOpen,onManage,onCreate,onHistory}:{
 projects:Project[];
 mode:'history'|'archive';
 currentId:string|null;
 busy:boolean;
 preview:boolean;
 onOpen:(project:Project,view:StudioView)=>void;
 onManage:(project:Project,action:'archive'|'restore')=>void;
 onCreate:()=>void;
 onHistory:()=>void;
}) {
 const archived=mode==='archive';
 const storageHint=preview?'项目和记录保存在当前浏览器中，其他浏览器或本机版中的项目不会自动同步。':'每个软件有独立的工作区与开发进度，切换项目会保留原来的步骤。';
 if(!projects.length)return <section className="library-empty">
  <span className="library-empty-icon">{archived?<Archive size={29}/>:<History size={29}/>}</span>
  <h2>{archived?'还没有归档项目':'还没有进行中的项目'}</h2>
  <p>{archived?'暂时告一段落的项目可以在「项目记录」中归档。文档、书签和进度都会保留，随时可以恢复。':'导入一份新的 PRD，开启另一个软件；也可以从「项目归档」恢复已有项目。'}</p>
  <button className="button primary" onClick={archived?onHistory:onCreate}>{archived?<History size={17}/>:<Plus size={17}/>}{archived?'返回项目记录':'导入 PRD，创建项目'}</button>
  <small>{storageHint}</small>
 </section>;
 return <section className="project-library">
  <div className="library-toolbar"><p>{archived?'保留每次开发的来路，需要时恢复到项目记录。':'多个软件，各自推进。选择一个继续开发，或回看它的记录。'}</p><span>{projects.length} 个项目</span></div>
  <div className="library-grid">{projects.map(p=><article className={`library-card ${p.id===currentId&&!archived?'current-project-card':''}`} key={p.id}>
   <div className="library-card-top"><span className="library-project-icon">{archived?<Archive size={21}/>:<FolderOpen size={21}/>}</span><span className={`library-status ${p.status==='failed'?'needs-attention':''}`}>{archived?'已归档':p.id===currentId?'当前搭建':p.status==='running'?'正在运行':p.status==='failed'?'需要处理':p.workflow==='completed'?'已完成':'可继续开发'}</span></div>
   <h2>{p.name}</h2><p className="library-filename"><FileText size={13}/>{p.filename}</p>
   <div className="library-progress"><Route size={15}/><span>第 {p.round} 轮 · {workflowSteps[stepIndex(p)]?.label||'项目已完成'}</span></div>
   <div className="library-counts"><span>{p.interview.length} 轮问答</span><span>{p.documents.length} 份文档</span><span>{p.bookmarks.length} 个{preview?'演示快照':'代码书签'}</span></div>
   <p className="library-updated">{archived?'归档于':'最近更新'} {new Date(p.archivedAt||p.updatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
   <div className="library-actions">
    {archived?<button className="button primary" disabled={busy} aria-label={`恢复到项目记录：${p.name}`} onClick={()=>onManage(p,'restore')}><RotateCcw size={15}/>恢复到项目记录</button>:<button className="button primary" aria-label={`继续开发：${p.name}`} onClick={()=>onOpen(p,'flow')}>继续开发<ArrowRight size={15}/></button>}
    <button className="button secondary" aria-label={`查看记录：${p.name}`} onClick={()=>onOpen(p,mode)}><History size={15}/>查看记录</button>
    {!archived&&<button className="button archive-action" disabled={busy||p.status==='running'} title={p.status==='running'?'请先暂停当前步骤或等待完成后再归档':'保留进度，可随时恢复'} aria-label={`归档项目：${p.name}`} onClick={()=>onManage(p,'archive')}><Archive size={15}/>归档</button>}
   </div>
   {!archived&&p.status==='running'&&<p className="library-running">任务继续运行中；暂停或完成后可归档。</p>}
  </article>)}</div>
  <p className="library-storage-hint">{storageHint}</p>
 </section>;
}
