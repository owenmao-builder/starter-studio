import type {AppData,Project,Workflow} from './types';
// Pages is a browser-only walkthrough. It never invokes a model or creates Git commits.
const key='starter-studio-public-preview-v1';
const runner={available:false,name:'流程演示 · 未连接模型'};
const load=():Project[]=>{try{return (JSON.parse(localStorage.getItem(key)||'[]') as Project[]).map(p=>({...p,archivedAt:p.archivedAt??null}));}catch{throw new Error('无法读取演示记录，请检查浏览器是否允许本地存储。');}};
const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
function persist(p:Project){p.revision++;p.updatedAt=new Date().toISOString();try{localStorage.setItem(key,JSON.stringify([p,...load().filter(v=>v.id!==p.id)]));}catch{throw new Error('浏览器存储空间不足，演示记录未保存。请下载重要内容后清理本站数据。');}return p;}
function at(p:Project,steps:Workflow[]){if(!steps.includes(p.workflow))throw new Error('请按顺序完成当前步骤。');}
function confirmed(body:Record<string,unknown>){if(body.confirmed!==true)throw new Error('请先明确确认当前内容。');}
function event(p:Project,title:string){p.activities.unshift({id:crypto.randomUUID(),title,detail:'公开流程演示；没有调用模型或执行真实开发。',kind:'info',time:new Date().toISOString()});}
async function plan(p:Project){
 p.version++;p.workflow='document';
 p.document=`# 第 ${p.round} 轮技术文档 · 演示示例\n\n> 这是用于体验确认流程的固定示例，不是模型根据 PRD 生成的可执行方案。\n\n## 本轮目标\n以「${p.name}」为例，演示一个最小功能闭环：接收输入、保存记录、展示结果。\n\n## 实现范围\n- 接收一份 Markdown 或 TXT 文档\n- 校验格式并保存到本地\n- 返回记录编号和状态\n\n## 数据与接口示例\nDocument：id、filename、content、createdAt。\nPOST /api/documents 接收文件，成功返回 id；格式无效返回 400。\n\n## 验收示例\n有效文件能读取；错误格式被拒绝；重新打开后记录仍在。\n\n## 费用与边界\n此在线演示不调用模型、不创建真实代码、不创建 Git commit。真实技术方案、代码书签与开发请在本机完整版中完成。\n${p.planningFeedback?'\n## 你提出的修改意见（仅记录，未由模型处理）\n'+p.planningFeedback:''}`;
 p.docHash=await digest(p.document);p.documents.push({round:p.round,stage:p.stage,version:p.version,document:p.document,docHash:p.docHash,createdAt:new Date().toISOString()});
}
export const previewApi={
 async list():Promise<AppData>{return{projects:load(),runner};},
 async get(id:string):Promise<Project>{const p=load().find(v=>v.id===id);if(!p)throw new Error('演示项目不存在。');return p;},
 async upload(file:File):Promise<Project>{
  if(!/\.(md|txt)$/i.test(file.name))throw new Error('在线演示支持 Markdown 和 TXT；Word / PDF 请使用本机完整版。');
  if(!file.size||file.size>10*1024*1024)throw new Error('请选择非空且小于 10 MB 的文件。');
  const prd=await file.text();if(!prd.trim()||prd.includes('\0'))throw new Error('请选择有效的文本 PRD。');
  const now=new Date().toISOString();
  const p:Project={schemaVersion:2,archivedAt:null,id:crypto.randomUUID(),name:(prd.match(/^#\s+(.+)$/m)?.[1]||file.name.replace(/\.[^.]+$/,'')).slice(0,60),filename:file.name,prd,createdAt:now,updatedAt:now,revision:0,stage:2,round:1,workflow:'questions',status:'waiting',job:null,document:'',version:0,docHash:'',reviewTree:'',questions:[{id:'audience',question:'第一版先给哪些人使用？（演示问题）',options:['自己和内部同事','对外开放'],recommendation:'自己和内部同事',reason:'这是用于体验问答界面的固定示例，未通过模型分析你的文档。',impact:'真实开发时，这一选择会影响权限和交付范围。'}],interview:[],interviewTurn:1,requirementSummary:'',requirementsHash:'',requirementsConfirmedAt:null,planningFeedback:'',bookmarks:[],approvals:[],activities:[],documents:[],lastRoundResult:null,result:null,error:null};
  event(p,'已在浏览器导入 PRD');return persist(p);
 },
 async action(id:string,body:Record<string,unknown>):Promise<Project>{
  const p=await this.get(id);
  if(body.revision!==p.revision)throw new Error('记录已更新，请刷新后操作。');
  if(p.archivedAt&&body.action!=='restore')throw new Error('项目已归档，请先恢复到项目记录后继续开发。');
  switch(body.action){
   case 'archive':if(p.status==='running'||p.job)throw new Error('项目任务正在运行，请先暂停当前步骤或等待完成后再归档。');p.archivedAt=new Date().toISOString();break;
   case 'restore':if(!p.archivedAt)throw new Error('项目已恢复，请刷新列表。');p.archivedAt=null;break;
   case 'answer':{
    at(p,['questions']);const answers=body.answers as Record<string,string>;
    if(p.questions.some(q=>!answers?.[q.id]?.trim()))throw new Error('请回答本轮问题。');
    p.interview.push({turn:p.interviewTurn,questions:p.questions,answers,time:new Date().toISOString()});p.questions=[];
    p.requirementSummary=`# 需求确认单 · 演示记录\n\n> 以下只组合了你的原文和回答，未经过模型分析。请体验“先确认需求、再生成技术文档”的顺序。\n\n## 本轮回答\n${Object.values(answers).join('\n')}\n\n## 你的 PRD 原文\n${p.prd}`;
    p.requirementsHash=await digest(p.requirementSummary);p.workflow='requirements';break;
   }
   case 'supplement':at(p,['requirements']);p.requirementSummary+=`\n\n## 你的补充（未经过模型分析）\n${String(body.note||'')}`;p.requirementsHash=await digest(p.requirementSummary);p.interviewTurn++;break;
   case 'confirm_requirements':at(p,['requirements']);confirmed(body);if(body.requirementsHash!==p.requirementsHash)throw new Error('请确认最新需求。');p.requirementsConfirmedAt=new Date().toISOString();await plan(p);break;
   case 'plan':at(p,['planning']);await plan(p);break;
   case 'revise':at(p,['document','bookmark','ready','review']);if(String(body.document).length<100)throw new Error('文档内容过短。');p.document=String(body.document);p.version++;p.docHash=await digest(p.document);p.workflow='document';p.documents.push({round:p.round,stage:p.stage,version:p.version,document:p.document,docHash:p.docHash,createdAt:new Date().toISOString()});break;
   case 'request_revision':at(p,['document','bookmark','ready','review']);p.planningFeedback=String(body.feedback||'');await plan(p);break;
   case 'confirm_document':at(p,['document']);confirmed(body);if(body.docHash!==p.docHash||body.version!==p.version)throw new Error('请审阅最新文档。');p.approvals.push({id:crypto.randomUUID(),stage:p.stage,round:p.round,version:p.version,docHash:p.docHash,bookmarkId:null,approvedAt:new Date().toISOString()});p.workflow='bookmark';break;
   case 'bookmark':{
    at(p,['bookmark']);const approval=p.approvals.findLast(a=>a.round===p.round&&a.version===p.version&&a.docHash===p.docHash);if(!approval)throw new Error('请先确认文档。');
    const bookmark={id:crypto.randomUUID(),commit:`preview-${p.round}-v${p.version}`,title:'浏览器流程快照（非 Git 代码书签）',round:p.round,stage:p.stage,createdAt:new Date().toISOString(),files:0};p.bookmarks.unshift(bookmark);approval.bookmarkId=bookmark.id;p.workflow='ready';break;
   }
   case 'develop':at(p,['ready']);confirmed(body);if(body.bookmarkId!==p.bookmarks[0]?.id||body.version!==p.version||body.docHash!==p.docHash)throw new Error('请先重新确认本轮文档和快照。');p.result='# 本轮结果 · 演示示例\n\n这里展示真实开发结束后等待用户验收的位置。\n\n当前没有连接编码模型，没有生成业务代码，也没有执行测试。勾选下方选项仅体验验收交互，不代表真实产物通过验收。';p.workflow='review';break;
   case 'accept':at(p,['review']);if(body.verified!==true||!['same','next'].includes(String(body.next)))throw new Error('请完成本轮验收选择。');if(body.next==='next'&&p.stage===5){p.workflow='completed';p.status='completed';break;}if(body.next==='next')p.stage++;p.lastRoundResult=p.result;p.result=null;p.round++;p.version=0;p.planningFeedback='';await plan(p);break;
   default:throw new Error('此操作需要本机完整版。');
  }
  event(p,body.action==='archive'?'项目已归档':body.action==='restore'?'项目已恢复到项目记录':`演示步骤：${String(body.action)}`);return persist(p);
 }
};
