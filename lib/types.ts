export const stages = [
  { name: 'PRD 体检', subtitle: '澄清需求', output: '已确认需求' },
  { name: '技术适配', subtitle: '选择实现方案', output: '技术适配声明' },
  { name: '后端 MVP', subtitle: '跑通核心能力', output: '核心代码与验证证据' },
  { name: '正式前端', subtitle: '完成产品体验', output: '前端代码与体验验证' },
  { name: '上线准备', subtitle: '准备部署与验收', output: '上线方案与验收清单' },
  { name: '项目收尾', subtitle: '整理交付', output: '使用文档与交付记录' },
] as const;
export type Workflow = 'questions' | 'requirements' | 'planning' | 'document' | 'bookmark' | 'ready' | 'development' | 'review' | 'completed';
export type Status = 'waiting' | 'running' | 'failed' | 'completed';
export type JobKind = 'analyze' | 'plan' | 'develop';
export interface Question { id: string; question: string; options: string[]; recommendation: string; reason: string; impact: string; }
export interface Interview { turn: number; questions: Question[]; answers: Record<string,string>; time: string }
export interface Bookmark { id: string; commit: string; title: string; stage: number; round: number; createdAt: string; files: number }
export interface Approval { id: string; stage: number; round: number; version: number; docHash: string; bookmarkId: string | null; approvedAt: string }
export interface Activity { id: string; title: string; detail: string; time: string; kind: 'info' | 'success' | 'warning' }
export interface PlanRecord { round: number; stage: number; version: number; document: string; docHash: string; createdAt: string }
export interface Project {
 schemaVersion: 2; id: string; name: string; filename: string; prd: string; createdAt: string; updatedAt: string; revision: number;
 archivedAt: string | null;
 stage: number; round: number; workflow: Workflow; status: Status; job: JobKind | null;
 document: string; version: number; docHash: string; reviewTree: string;
 questions: Question[]; interview: Interview[]; interviewTurn: number; requirementSummary: string; requirementsHash: string; requirementsConfirmedAt: string | null;
 planningFeedback: string; bookmarks: Bookmark[]; approvals: Approval[]; activities: Activity[]; documents: PlanRecord[];
 lastRoundResult: string | null; result: string | null; error: string | null;
}
export interface AppData { projects: Project[]; runner: { available: boolean; name: string }; }
export const workflowSteps = [
 {key:'upload',label:'导入 PRD',owner:'你',description:'带上你的产品想法'},
 {key:'questions',label:'模型提问',owner:'AI ↔ 你',description:'每轮最多 5 个问题'},
 {key:'requirements',label:'确认需求',owner:'你',description:'对齐范围与验收标准'},
 {key:'planning',label:'生成技术文档',owner:'AI',description:'根据已确认需求编写'},
 {key:'document',label:'确认技术文档',owner:'你',description:'审阅本轮实现方案'},
 {key:'bookmark',label:'保存代码书签',owner:'系统',description:'为本轮开发留下退路'},
 {key:'development',label:'按文档开发',owner:'AI',description:'只执行本轮确认范围'},
 {key:'review',label:'验收本轮成果',owner:'你',description:'通过后进入下一轮文档'},
] as const;
export function stepIndex(p: Project) {return p.workflow==='ready'?6:p.workflow==='completed'?8:workflowSteps.findIndex(s=>s.key===p.workflow);}
