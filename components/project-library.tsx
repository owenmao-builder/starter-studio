import {ArrowRight,FileText,FolderOpen,History,Plus,Route} from 'lucide-react';
import {stepIndex,workflowSteps,type Project} from '@/lib/types';
import type {StudioView} from '@/lib/navigation';

export default function ProjectLibrary({projects,recordsOnly,preview,onOpen,onCreate}:{
 projects:Project[];
 recordsOnly:boolean;
 preview:boolean;
 onOpen:(project:Project,view:StudioView)=>void;
 onCreate:()=>void;
}) {
 const storageHint=preview?'项目和记录保存在当前浏览器中，其他浏览器或本机版中的项目不会自动同步。':'项目和记录保存在本机工作区，创建后可从这里继续。';
 if(!projects.length) return <section className="library-empty">
  <span className="library-empty-icon">{recordsOnly?<History size={29}/>:<FolderOpen size={29}/>}</span>
  <h2>{recordsOnly?'还没有项目记录':'还没有项目'}</h2>
  <p>{recordsOnly?'先导入一份 PRD 创建项目，问答、文档、确认和书签会按开发轮次记录在这里。':'导入第一份 PRD，开始需求澄清。已有项目会出现在这里，方便随时继续。'}</p>
  <button className="button primary" onClick={onCreate}><Plus size={17}/>导入 PRD，创建项目</button>
  <small>{storageHint}</small>
 </section>;
 return <section className="project-library">
  <div className="library-toolbar"><p>{recordsOnly?'选择一个项目，查看它的问答与开发记录。':`共 ${projects.length} 个项目，选择一个继续搭建。`}</p><span>{projects.length} 个项目</span></div>
  <div className="library-grid">{projects.map(p=><article className="library-card" key={p.id}>
   <div className="library-card-top"><span className="library-project-icon"><FolderOpen size={21}/></span><span className={`library-status ${p.status==='failed'?'needs-attention':''}`}>{p.status==='running'?'正在进行':p.status==='failed'?'需要处理':p.workflow==='completed'?'已完成':'等待下一步'}</span></div>
   <h2>{p.name}</h2><p className="library-filename"><FileText size={13}/>{p.filename}</p>
   <div className="library-progress"><Route size={15}/><span>第 {p.round} 轮 · {workflowSteps[stepIndex(p)]?.label||'项目已完成'}</span></div>
   <div className="library-counts"><span>{p.interview.length} 轮问答</span><span>{p.documents.length} 份文档</span><span>{p.bookmarks.length} 个{preview?'演示快照':'代码书签'}</span></div>
   <p className="library-updated">最近更新 {new Date(p.updatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
   <div className="library-actions">{!recordsOnly&&<button className="button primary" aria-label={`继续搭建：${p.name}`} onClick={()=>onOpen(p,'flow')}>继续搭建<ArrowRight size={15}/></button>}<button className={`button ${recordsOnly?'primary':'secondary'}`} aria-label={`查看记录：${p.name}`} onClick={()=>onOpen(p,'history')}><History size={15}/>查看记录</button></div>
  </article>)}</div>
  <p className="library-storage-hint">{storageHint}</p>
 </section>;
}
