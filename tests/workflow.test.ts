import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createProject,read,revise,authorize,advance,git,workspace,locked,applyAnalysis,answerQuestions,confirmRequirements,confirmDocument,checkpoint,setPlan,checkRevision,dataRoot,setArchived} from '../lib/store';
import {parseUpload} from '../lib/upload';
import {guard} from '../lib/http';
import {recover,applyJobResult,promptFor} from '../lib/runner';
import type {Project,Question} from '../lib/types';
let root='';
const prd='# 测试阅读助手\n\n面向学生用户，上传学习资料，生成摘要。流程需要逐步确认。MVP 第一版支持文档上传与摘要下载。验收标准为覆盖全部要点。预算每月 100 元，隐私数据保存在本机。';
const summary='# 已整理的需求\n\n目标用户：学生。输入学习资料，输出知识卡片。第一版只做上传、确认和导出。成本不超过每月 100 元。文件保存在本机。验收要求摘要覆盖原文所有关键主题。';
const plan='# 第 1 轮技术文档\n\n## 范围\n只实现资料上传和持久化，不做模型生成。\n\n## 数据结构\nDocument: id、filename、content、createdAt。使用本地 JSON 原子写入。\n\n## API\nPOST /api/documents 接受 multipart 文件，返回 id；超过 10 MB 返回 413。\n\n## 验收\n上传成功后重启服务，文档仍能读取。无效格式被拒绝。';
const question:Question={id:'audience',question:'第一版谁来使用？',options:['内部试用','对外开放'],recommendation:'内部试用',reason:'决定权限范围',impact:'不确认可能超出第一版范围'};
before(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'studio-flow-test-'));process.env.STUDIO_DATA_DIR=root;});
after(async()=>{delete process.env.STUDIO_DATA_DIR;await fs.rm(root,{recursive:true,force:true});});
async function requirementsReady(){const p=await createProject('需求.md',prd);await applyAnalysis(p,summary,[]);return p;}
async function documentReady(){const p=await requirementsReady();await confirmRequirements(p,p.requirementsHash);await setPlan(p,plan);return p;}
async function developReady(){const p=await documentReady();await confirmDocument(p,p.version,p.docHash);await checkpoint(p);return p;}
test('PRD 导入只进入提问，不平行生成文档或书签；文件与状态已持久化',async()=>{const p=await createProject('需求.md',prd);assert.equal(p.workflow,'questions');assert.equal(p.document,'');assert.equal(p.bookmarks.length,0);assert.equal(p.approvals.length,0);assert.deepEqual((await read(p.id)).prd,prd);assert.equal(await fs.readFile(path.join(workspace(p.id),'docs/PRD/PRD.md'),'utf8'),prd);});
test('模型提问、用户回答、继续提问构成循环，缺口未关闭不能确认需求',async()=>{const p=await createProject('需求.md',prd);await applyAnalysis(p,summary,[question]);await assert.rejects(()=>confirmRequirements(p,p.requirementsHash),/当前步骤/);await assert.rejects(()=>answerQuestions(p,{}),/全部问题/);await answerQuestions(p,{audience:'内部试用'});assert.equal(p.interview[0].answers.audience,'内部试用');await applyAnalysis(p,summary,[{...question,id:'budget',question:'预算上限多少？'}]);assert.equal(p.workflow,'questions');assert.equal(p.interviewTurn,2);assert.equal(p.bookmarks.length,0);});
test('需求确认绑定摘要，确认前不能生成技术文档',async()=>{const p=await requirementsReady();await assert.rejects(()=>setPlan(p,plan),/先确认需求/);await assert.rejects(()=>confirmRequirements(p,'stale'),/最新需求/);await confirmRequirements(p,p.requirementsHash);assert.equal(p.workflow,'planning');assert.equal(p.document,'');assert.equal(p.bookmarks.length,0);});
test('技术文档 → 确认文档 → 代码书签 → 开发的先后关系由后端强制执行',async()=>{const p=await documentReady();await assert.rejects(()=>checkpoint(p),/当前步骤/);await assert.rejects(()=>authorize(p,p.version,p.docHash,'missing'),/当前步骤/);await assert.rejects(()=>confirmDocument(p,0,p.docHash),/已更新/);await confirmDocument(p,p.version,p.docHash);assert.equal(p.workflow,'bookmark');assert.equal(p.bookmarks.length,0);await assert.rejects(()=>authorize(p,p.version,p.docHash,'missing'),/当前步骤/);await checkpoint(p);assert.equal(p.workflow,'ready');assert.equal(p.approvals[0].bookmarkId,p.bookmarks[0].id);await authorize(p,p.version,p.docHash,p.bookmarks[0].id);assert.equal(p.workflow,'development');});
test('书签是可读取的真实 Git 快照，环境密钥不会进入快照',async()=>{const p=await documentReady();await fs.writeFile(path.join(workspace(p.id),'.env'),'TEST_TOKEN=secret');await confirmDocument(p,p.version,p.docHash);await checkpoint(p);assert.match(p.bookmarks[0].commit,/^[a-f0-9]{40}$/);assert.equal(await git(p.id,['show',`${p.bookmarks[0].commit}:docs/PRD/PRD.md`]),prd);assert.ok(!(await git(p.id,['ls-tree','-r','--name-only','HEAD'])).split('\n').includes('.env'));});
test('文档或代码变化后旧确认失效，不自动补书签绕过审阅',async()=>{const p=await developReady();await fs.writeFile(path.join(workspace(p.id),'app.txt'),'changed');await assert.rejects(()=>authorize(p,p.version,p.docHash,p.bookmarks[0].id),/代码已变化/);const before=p.bookmarks.length;await revise(p,p.document+'\n补充上传数据处理范围。');assert.equal(p.workflow,'document');assert.equal(p.version,2);assert.equal(p.bookmarks.length,before);await assert.rejects(()=>checkpoint(p),/当前步骤/);await confirmDocument(p,p.version,p.docHash);await checkpoint(p);assert.equal(p.bookmarks.length,before+1);});
test('并发和重复启动最多生效一次，过期页面提交被拒绝',async()=>{const p=await developReady();assert.throws(()=>checkRevision(p,p.revision-1),/已更新/);const call=()=>locked(p.id,async()=>{const current=await read(p.id);return authorize(current,p.version,p.docHash,p.bookmarks[0].id);});const results=await Promise.allSettled([call(),call()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await assert.rejects(()=>advance(awaitable(p),'next'),/当前步骤/);function awaitable(v:Project){return{...v,workflow:'development' as const,status:'running' as const};}});
test('开发结束停在验收；验收后进入下一轮文档，支持同阶段子轮次',async()=>{const p=await developReady();await authorize(p,p.version,p.docHash,p.bookmarks[0].id);await applyJobResult(p,'develop','代码完成，测试通过，请核对。');assert.equal(p.workflow,'review');const stage=p.stage;await advance(p,'same');assert.equal(p.stage,stage);assert.equal(p.round,2);assert.equal(p.lastRoundResult,'代码完成，测试通过，请核对。');assert.match(promptFor(p,'plan'),/上一轮验收结果：代码完成/);assert.equal(p.workflow,'planning');assert.equal(p.document,'');assert.equal(p.documents.length,1);assert.equal(p.bookmarks.length,1);assert.ok(p.requirementsConfirmedAt);});
test('服务重启后的任务停留当前步骤，不自动跳过确认或重跑',async()=>{const p=await developReady();await authorize(p,p.version,p.docHash,p.bookmarks[0].id);const recovered=await recover(await read(p.id));assert.equal(recovered.status,'failed');assert.equal(recovered.workflow,'development');assert.match(recovered.error!,/服务重启/);await assert.rejects(()=>authorize(recovered,p.version,p.docHash,p.bookmarks[0].id),/当前步骤/);});
test('无效模型输出被拒绝；只读提问和规划任务禁止提前写代码',async()=>{const p=await createProject('需求.md',prd);await assert.rejects(()=>applyJobResult(p,'analyze','not JSON'));await assert.rejects(()=>applyJobResult(p,'analyze',JSON.stringify({summary,questions:Array(6).fill(question)})));assert.equal(p.workflow,'questions');assert.equal(p.document,'');assert.match(promptFor(p,'analyze'),/不写任何代码或技术开发文档/);assert.match(promptFor(p,'plan'),/不要保存 Git 书签/);});
test('原有项目迁移保留文件、文档和书签，不把旧模板当已确认需求',async()=>{const p=await developReady();const legacy={...p,schemaVersion:undefined,status:'pending_approval'};await fs.writeFile(path.join(dataRoot(),'state',`${p.id}.json`),JSON.stringify(legacy));const migrated=await read(p.id);assert.equal(migrated.workflow,'questions');assert.equal(migrated.requirementsConfirmedAt,null);assert.equal(migrated.document,'');assert.equal(migrated.bookmarks.length,1);assert.equal(migrated.documents.length,1);assert.equal(await fs.readFile(path.join(workspace(p.id),'docs/PRD/PRD.md'),'utf8'),prd);});
test('上传校验拒绝空文件、假 PDF、二进制文本和不支持格式',async()=>{for(const file of[new File([],'empty.md'),new File(['invalid pdf'],'fake.pdf'),new File(['abc\0binary'],'bad.txt'),new File(['script'],'bad.exe')])await assert.rejects(()=>parseUpload(file));const valid=await parseUpload(new File([prd],'../../需求.md'));assert.equal(valid.filename.includes('/'),false);});
test('真实 PDF 和 DOCX 可提取正文',async()=>{for(const ext of['pdf','docx']){const bytes=await fs.readFile(path.join(process.cwd(),'tests/fixtures',`valid.${ext}`));const result=await parseUpload(new File([bytes],`valid.${ext}`));assert.match(result.text,/knowledge cards/);}});
test('API 限制本机同源请求与专用请求头',()=>{assert.throws(()=>guard(new Request('http://127.0.0.1:3100/api/projects',{headers:{host:'attacker.example'}})),/本机访问/);assert.throws(()=>guard(new Request('http://127.0.0.1:3100/api/projects',{headers:{host:'127.0.0.1:3100',origin:'https://attacker.example','x-studio-request':'1'}}),true),/不受信任/);assert.throws(()=>guard(new Request('http://127.0.0.1:3100/api/projects',{headers:{host:'127.0.0.1:3100'}}),true),/工作台发起/);});
test('归档保留真实代码书签和审批，重读后禁止开发，恢复后可从原步骤继续',async()=>{
 const p=await developReady();
 const before=structuredClone(p);const head=await git(p.id,['rev-parse','HEAD']);
 await setArchived(p,true);
 let restored=await read(p.id);
 assert.ok(restored.archivedAt);assert.equal(restored.workflow,'ready');
 assert.deepEqual(restored.documents,before.documents);assert.deepEqual(restored.approvals,before.approvals);assert.deepEqual(restored.bookmarks,before.bookmarks);
 await assert.rejects(()=>authorize(restored,restored.version,restored.docHash,restored.bookmarks[0].id),/已归档/);
 await setArchived(restored,false);restored=await read(p.id);
 assert.equal(restored.archivedAt,null);assert.equal(restored.workflow,'ready');assert.equal(restored.status,'waiting');
 assert.equal(await git(p.id,['rev-parse','HEAD']),head);
 await authorize(restored,restored.version,restored.docHash,restored.bookmarks[0].id);assert.equal(restored.workflow,'development');
});
test('归档一个软件不改变其他软件，运行中的任务不能归档',async()=>{
 const first=await createProject('软件甲.md',prd);const second=await developReady();
 const firstBefore=await read(first.id);
 await authorize(second,second.version,second.docHash,second.bookmarks[0].id);
 await assert.rejects(()=>setArchived(second,true),/任务正在运行/);
 await setArchived(first,true);
 const secondAfter=await read(second.id);assert.equal(secondAfter.archivedAt,null);assert.equal(secondAfter.workflow,'development');
 await setArchived(await read(first.id),false);
 const firstAfter=await read(first.id);assert.equal(firstAfter.workflow,firstBefore.workflow);assert.equal(firstAfter.prd,firstBefore.prd);
 assert.equal(firstAfter.job,null);assert.equal(firstAfter.bookmarks.length,0);
});
test('已有版本 2 项目缺少归档字段时仍保留全部数据并默认为未归档',async()=>{
 const p=await documentReady();const legacy:Partial<Project>={...p};delete legacy.archivedAt;
 await fs.writeFile(path.join(dataRoot(),'state',`${p.id}.json`),JSON.stringify(legacy));
 const loaded=await read(p.id);assert.equal(loaded.archivedAt,null);assert.deepEqual(loaded.documents,p.documents);assert.equal(loaded.workflow,'document');
});
