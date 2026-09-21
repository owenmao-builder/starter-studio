import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Project, Activity, Bookmark, Question } from './types';
import { stages } from './types';
const exec = promisify(execFile);
export const dataRoot = () => process.env.STUDIO_DATA_DIR || path.join(process.cwd(), '.studio');
export const workspace = (id: string) => path.join(dataRoot(), 'workspaces', validID(id));
function validID(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new AppError('INVALID_ID', '项目不存在', 404); return id; }
const stateFile = (id: string) => path.join(dataRoot(), 'state', `${validID(id)}.json`);
export class AppError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function activity(p: Project, title: string, detail: string, kind: Activity['kind'] = 'info') { p.activities.unshift({ id: randomUUID(), title, detail, kind, time: new Date().toISOString() }); }
export async function save(p: Project) {
 p.updatedAt = new Date().toISOString(); p.revision++;
 await fs.mkdir(path.dirname(stateFile(p.id)), { recursive: true });
 const temp = `${stateFile(p.id)}.${randomUUID()}.tmp`;
 await fs.writeFile(temp, JSON.stringify(p, null, 2), { mode: 0o600 });
 await fs.rename(temp, stateFile(p.id));
}
function defaults() {return {schemaVersion:2 as const,archivedAt:null,revision:0,stage:2,round:1,workflow:'questions' as const,status:'waiting' as const,job:null,document:'',version:0,docHash:'',reviewTree:'',questions:[],interview:[],interviewTurn:0,requirementSummary:'',requirementsHash:'',requirementsConfirmedAt:null,planningFeedback:'',bookmarks:[],approvals:[],activities:[],documents:[],lastRoundResult:null,result:null,error:null};}
export async function read(id: string): Promise<Project> {
 let raw: Project;
 try {raw=JSON.parse(await fs.readFile(stateFile(id),'utf8'));} catch(e){if(e instanceof AppError)throw e;throw new AppError('NOT_FOUND','项目不存在',404);}
 if(raw.schemaVersion===2)return {...raw,archivedAt:raw.archivedAt??null,lastRoundResult:raw.lastRoundResult??null};
 // Keep the previous files and history. A legacy template is not a confirmed requirement.
 return { ...raw,...defaults(),bookmarks:(raw.bookmarks||[]).map(b=>({...b,round:1})),documents:raw.document?[{round:1,stage:raw.stage,version:raw.version,document:raw.document,docHash:raw.docHash,createdAt:raw.updatedAt}]:[],activities:[{id:'workflow-migration',title:'已切换为顺序流程',detail:'原有文件与书签已保留在项目记录。先澄清并确认需求，再生成新的技术文档。',time:new Date().toISOString(),kind:'info'},...(raw.activities||[])] };
}
export async function list(): Promise<Project[]> {
 await fs.mkdir(path.join(dataRoot(), 'state'), { recursive: true });
 const files=(await fs.readdir(path.join(dataRoot(),'state'))).filter(f=>f.endsWith('.json'));
 return (await Promise.all(files.map(f=>read(f.slice(0,-5))))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
const globals=globalThis as typeof globalThis & {studioLocks?:Map<string,Promise<unknown>>};
const locks=globals.studioLocks ||=new Map();
export async function locked<T>(id:string,task:()=>Promise<T>):Promise<T>{const previous=locks.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(task);locks.set(id,next);try{return await next;}finally{if(locks.get(id)===next)locks.delete(id);}}
export async function git(id:string,args:string[]){return (await exec('git',['-c','core.hooksPath=/dev/null',...args],{cwd:workspace(id),timeout:30000,maxBuffer:8*1024*1024})).stdout.trim();}
export async function tree(p:Project){await git(p.id,['add','-A']);return git(p.id,['write-tree']);}
export function requireActive(p:Project){if(p.archivedAt)throw new AppError('PROJECT_ARCHIVED','项目已归档，请先恢复到项目记录后继续开发',409);}
export function requireStep(p:Project,allowed:Project['workflow'][]){requireActive(p);if(p.status==='running'||!allowed.includes(p.workflow))throw new AppError('INVALID_STEP','请先完成当前步骤，不能跳过前面的确认',409);}
export async function setArchived(p:Project,archived:boolean){
 if(p.status==='running'||p.job)throw new AppError('PROJECT_RUNNING','项目任务正在运行，请先暂停当前步骤或等待完成后再归档',409);
 if(Boolean(p.archivedAt)===archived)throw new AppError('STALE_ARCHIVE',archived?'项目已归档，请刷新列表':'项目已恢复，请刷新列表',409);
 p.archivedAt=archived?new Date().toISOString():null;
 activity(p,archived?'项目已归档':'项目已恢复到项目记录',`保留第 ${p.round} 轮的进度、文档和书签；继续开发仍需按步骤确认。`,'success');
 await save(p);return p;
}
export function checkRevision(p:Project,revision:number){if(p.revision!==revision)throw new AppError('STALE_STATE','项目已更新，请刷新后再操作',409);}
export function planPath(p:Project){return path.join(workspace(p.id),`docs/阶段文档/第${p.round}轮-开发方案.md`);}
export async function createProject(filename:string,prd:string):Promise<Project>{
 const now=new Date().toISOString();
 const name=(prd.match(/^#\s+(.+)$/m)?.[1]||filename.replace(/\.[^.]+$/,'')).replace(/PRD|产品需求文档/gi,'').replace(/^[\s·—-]+|[\s·—-]+$/g,'').slice(0,60)||'我的新产品';
 const p:Project={...defaults(),id:randomUUID(),name,filename,prd,createdAt:now,updatedAt:now};
 const dir=workspace(p.id);await fs.mkdir(path.join(dir,'docs/PRD'),{recursive:true});await fs.mkdir(path.join(dir,'docs/阶段文档'),{recursive:true});
 await fs.copyFile(path.join(process.cwd(),'AGENTS.md'),path.join(dir,'AGENTS.md'));
 await fs.copyFile(path.join(process.cwd(),'CLAUDE.md'),path.join(dir,'CLAUDE.md'));
 await fs.copyFile(path.join(process.cwd(),'LICENSE'),path.join(dir,'LICENSE'));
 await fs.cp(path.join(process.cwd(),'docs/手册'),path.join(dir,'docs/手册'),{recursive:true});
 await fs.writeFile(path.join(dir,'docs/PRD/PRD.md'),prd);
 await fs.writeFile(path.join(dir,'.gitignore'),'.env\n.env.*\n!.env.example\nnode_modules/\n.next/\n.venv/\n__pycache__/\ndata/\n*.pem\n*.key\ncredentials*\n.DS_Store\n');
 await fs.writeFile(path.join(dir,'docs/项目状态.md'),'# 项目状态\n\n当前步骤：PRD 体检与模型提问。需求尚未确认，不能生成开发计划或开始写代码。\n');
 await git(p.id,['init']);
 activity(p,'PRD 已导入',`${filename} · 下一步：模型阅读并提问`,'success');
 await save(p);return p;
}
export async function applyAnalysis(p:Project,summary:string,questions:Question[]){
 p.job=null;p.status='waiting';p.requirementSummary=summary;p.requirementsHash=hash(summary);p.questions=questions;p.interviewTurn++;
 p.workflow=questions.length?'questions':'requirements';p.error=null;
 activity(p,questions.length?'模型提出了待澄清问题':'需求已整理，等待你的确认',questions.length?`第 ${p.interviewTurn} 轮 · ${questions.length} 个问题`:'确认目标、范围、成本与验收标准后，才会编写技术文档。');
 await save(p);return p;
}
export async function answerQuestions(p:Project,answers:Record<string,string>){
 requireStep(p,['questions']);if(!p.questions.length)throw new AppError('NO_QUESTIONS','请先让模型阅读 PRD 并提问',409);
 for(const q of p.questions)if(!answers[q.id]?.trim())throw new AppError('MISSING_ANSWER','请回答本轮全部问题，也可以填写“不确定”');
 const clean=Object.fromEntries(p.questions.map(q=>[q.id,answers[q.id].trim().slice(0,5000)]));
 p.interview.push({turn:p.interviewTurn,questions:p.questions,answers:clean,time:new Date().toISOString()});p.questions=[];p.error=null;
 await fs.writeFile(path.join(workspace(p.id),'docs/PRD/补充回答.md'),p.interview.map(r=>`## 第 ${r.turn} 轮\n\n`+r.questions.map(q=>`### ${q.question}\n\n${r.answers[q.id]}`).join('\n\n')).join('\n\n'));
 activity(p,'已提交本轮回答','模型会重新检查缺口；有新的必要问题时再继续一轮。','success');await save(p);return p;
}
export async function supplement(p:Project,note:string){
 requireStep(p,['requirements']);p.requirementsConfirmedAt=null;p.workflow='questions';
 p.interview.push({turn:p.interviewTurn,questions:[{id:'supplement',question:'用户补充',options:[],recommendation:'',reason:'',impact:''}],answers:{supplement:note},time:new Date().toISOString()});
 activity(p,'用户补充了需求','模型将重新整理需求确认单。');await save(p);return p;
}
export async function confirmRequirements(p:Project,requirementsHash:string){
 requireStep(p,['requirements']);if(p.questions.length||!p.requirementSummary||p.requirementsHash!==requirementsHash)throw new AppError('STALE_REQUIREMENTS','请先完成问答并确认最新需求',409);
 p.requirementsConfirmedAt=new Date().toISOString();p.workflow='planning';p.status='waiting';p.error=null;
 await fs.writeFile(path.join(workspace(p.id),'docs/PRD/已确认需求.md'),p.requirementSummary);
 activity(p,'你已确认需求',`下一步：模型根据这份需求生成第 ${p.round} 轮技术文档。`,'success');await save(p);return p;
}
export async function setPlan(p:Project,document:string){
 if(!p.requirementsConfirmedAt)throw new AppError('REQUIREMENTS_NOT_CONFIRMED','请先确认需求',409);
 p.document=document;p.version++;p.docHash=hash(document);p.workflow='document';p.status='waiting';p.job=null;p.error=null;
 await fs.writeFile(planPath(p),document);
 await fs.writeFile(path.join(workspace(p.id),'docs/项目状态.md'),`# 项目状态\n\n## 当前阶段\n- 阶段：${p.stage} ${stages[p.stage].name}\n- 当前开发轮次：第 ${p.round} 轮\n- 最近更新：${new Date().toISOString()}\n- 当前方案：docs/阶段文档/第${p.round}轮-开发方案.md（v${p.version}）\n- 已确认需求：docs/PRD/已确认需求.md\n\n## 推进规则\n本轮技术文档已生成，等待工作台中的人工确认。只有工作台完成文档确认和开发前代码书签后，才会发起开发任务。执行时遵守该次任务的授权范围，完成后等待验收，不得自动进入下一轮。\n\n## 上一轮验收结果\n${p.lastRoundResult||'尚无上一轮。'}\n`);
 p.reviewTree=await tree(p);
 p.documents.push({round:p.round,stage:p.stage,version:p.version,document,docHash:p.docHash,createdAt:new Date().toISOString()});
 activity(p,'技术文档待确认',`第 ${p.round} 轮 · v${p.version}。确认前不会保存开发书签或开始写代码。`);await save(p);return p;
}
export async function revise(p:Project,document:string){requireStep(p,['document','bookmark','ready','review']);p.result=null;return setPlan(p,document);}
export async function requestRevision(p:Project,feedback:string){requireStep(p,['document','review','ready','bookmark','development']);p.planningFeedback=feedback;p.workflow='planning';p.status='waiting';p.error=null;activity(p,'已提出方案修改意见','模型重新编写本轮文档，修改后仍需确认。');await save(p);return p;}
export function currentApproval(p:Project){return p.approvals.findLast(a=>a.round===p.round&&a.version===p.version&&a.docHash===p.docHash);}
export async function confirmDocument(p:Project,version:number,docHash:string){
 requireStep(p,['document']);if(p.version!==version||p.docHash!==docHash||!p.document)throw new AppError('STALE_APPROVAL','文档已更新，请重新审阅',409);
 if(await tree(p)!==p.reviewTree)throw new AppError('CODE_CHANGED','项目文件已变化，请重新保存文档后审阅',409);
 p.approvals.push({id:randomUUID(),stage:p.stage,round:p.round,version,docHash,bookmarkId:null,approvedAt:new Date().toISOString()});
 p.workflow='bookmark';p.status='waiting';activity(p,'你已确认技术文档',`第 ${p.round} 轮 · v${version}。下一步保存开发前代码书签。`,'success');await save(p);return p;
}
export async function checkpoint(p:Project):Promise<Project>{
 requireStep(p,['bookmark']);const approval=currentApproval(p);if(!approval)throw new AppError('NO_APPROVAL','技术文档尚未确认',409);
 if(await tree(p)!==p.reviewTree)throw new AppError('CODE_CHANGED','确认后项目文件发生了变化，请重新审阅技术文档',409);
 await git(p.id,['-c','user.name=Starter Studio','-c','user.email=studio@localhost','commit','--allow-empty','-m',`bookmark: round ${p.round} ${stages[p.stage].name} v${p.version}`]);
 const commit=await git(p.id,['rev-parse','HEAD']);
 const bookmark:Bookmark={id:randomUUID(),commit,title:`第 ${p.round} 轮 · ${stages[p.stage].name} · 开发前`,round:p.round,stage:p.stage,createdAt:new Date().toISOString(),files:(await git(p.id,['ls-tree','-r','--name-only','HEAD'])).split('\n').filter(Boolean).length};
 p.bookmarks.unshift(bookmark);approval.bookmarkId=bookmark.id;p.workflow='ready';
 activity(p,'代码书签已保存',`文档确认 → ${commit.slice(0,7)} → 可以开始本轮开发`,'success');await save(p);return p;
}
export async function authorize(p:Project,version:number,docHash:string,bookmarkId:string){
 requireStep(p,['ready']);const approval=currentApproval(p);
 if(!approval||p.version!==version||p.docHash!==docHash||approval.bookmarkId!==bookmarkId||p.bookmarks[0]?.id!==bookmarkId)throw new AppError('STALE_APPROVAL','文档或书签已变化，请重新确认',409);
 if(await git(p.id,['rev-parse','HEAD'])!==p.bookmarks[0].commit||await git(p.id,['status','--porcelain']))throw new AppError('CODE_CHANGED','书签保存后代码已变化，请重新审阅并保存书签',409);
 p.workflow='development';p.status='running';p.job='develop';p.result=null;p.error=null;activity(p,'开始按已确认文档开发',`第 ${p.round} 轮 · ${stages[p.stage].name}`);await save(p);return p;
}
export async function advance(p:Project,next:'same'|'next'){
 requireStep(p,['review']);activity(p,'你已验收本轮成果',`第 ${p.round} 轮 · ${stages[p.stage].name}`,'success');
 if(next==='next'&&p.stage===5){p.workflow='completed';p.status='completed';await save(p);return p;}
 if(next==='next')p.stage++;
 p.lastRoundResult=p.result;p.round++;p.version=0;p.document='';p.docHash='';p.reviewTree='';p.result=null;p.error=null;p.planningFeedback='';p.workflow='planning';p.status='waiting';p.job=null;
 activity(p,'进入下一轮技术文档',`第 ${p.round} 轮 · ${stages[p.stage].name}。仍然先出文档，再确认、保存书签与开发。`);
 await save(p);return p;
}
