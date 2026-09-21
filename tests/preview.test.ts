import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {previewApi} from '../lib/preview-api';
const store=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>{store.set(key,value);}},configurable:true});
beforeEach(()=>store.clear());
const prd=new File(['# 在线演示测试\n目标是体验 PRD 到需求确认的顺序。'],'test.md');
test('公开预览在浏览器保存记录，拒绝跳步和过期操作，每轮重新确认',async()=>{
 let p=await previewApi.upload(prd);
 assert.equal(p.workflow,'questions');assert.equal(p.bookmarks.length,0);assert.equal(p.document,'');
 await assert.rejects(()=>previewApi.action(p.id,{action:'bookmark',revision:p.revision}),/按顺序/);
 await assert.rejects(()=>previewApi.action(p.id,{action:'answer',revision:p.revision-1,answers:{audience:'内部'}}),/已更新/);
 const act=async(action:string,values:Record<string,unknown>={})=>{p=await previewApi.action(p.id,{action,revision:p.revision,...values});};
 await act('answer',{answers:{audience:'内部'}});assert.match(p.requirementSummary,/未经过模型分析/);
 await assert.rejects(()=>act('confirm_requirements',{requirementsHash:p.requirementsHash}),/明确确认/);
 await act('confirm_requirements',{confirmed:true,requirementsHash:p.requirementsHash});assert.equal(p.workflow,'document');assert.match(p.document,/演示示例/);
 await act('confirm_document',{confirmed:true,version:p.version,docHash:p.docHash});assert.equal(p.bookmarks.length,0);
 await act('bookmark');assert.match(p.bookmarks[0].title,/非 Git/);
 await act('develop',{confirmed:true,version:p.version,docHash:p.docHash,bookmarkId:p.bookmarks[0].id});assert.match(p.result!,/没有生成业务代码/);
 await act('accept',{verified:true,next:'same'});assert.equal(p.round,2);assert.equal(p.workflow,'document');assert.equal(p.bookmarks.length,1);
 await assert.rejects(()=>act('develop',{confirmed:true,version:p.version,docHash:p.docHash,bookmarkId:p.bookmarks[0].id}),/按顺序/);
 assert.equal((await previewApi.get(p.id)).round,2);
});
test('公开预览明确拒绝需要服务端解析的文件，不伪称支持 PDF',async()=>{
 await assert.rejects(()=>previewApi.upload(new File(['text'],'file.pdf')),/本机完整版/);
 await assert.rejects(()=>previewApi.upload(new File(['\0binary'],'file.txt')),/有效的文本/);
 assert.equal((await previewApi.list()).runner.available,false);
});
