import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { AppError,read,locked,revise,advance,workspace,checkRevision,answerQuestions,supplement,confirmRequirements,confirmDocument,checkpoint,requestRevision,setArchived,requireActive } from '@/lib/store';
import { start,cancel,recover,startAnalysis,startPlanning } from '@/lib/runner';
import { guard,errorResponse } from '@/lib/http';
const exec=promisify(execFile);
export const runtime='nodejs';export const dynamic='force-dynamic';
const revision={revision:z.number().int().nonnegative()};
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('archive'),...revision}),
 z.object({action:z.literal('restore'),...revision}),
 z.object({action:z.literal('analyze'),...revision}),
 z.object({action:z.literal('answer'),answers:z.record(z.string(),z.string().min(1).max(5000)),...revision}),
 z.object({action:z.literal('supplement'),note:z.string().min(1).max(10000),...revision}),
 z.object({action:z.literal('confirm_requirements'),requirementsHash:z.string(),confirmed:z.literal(true),...revision}),
 z.object({action:z.literal('plan'),...revision}),
 z.object({action:z.literal('revise'),document:z.string().min(100).max(100000),...revision}),
 z.object({action:z.literal('request_revision'),feedback:z.string().min(1).max(10000),...revision}),
 z.object({action:z.literal('confirm_document'),version:z.number().int(),docHash:z.string(),confirmed:z.literal(true),...revision}),
 z.object({action:z.literal('bookmark'),...revision}),
 z.object({action:z.literal('develop'),version:z.number().int(),docHash:z.string(),bookmarkId:z.string(),confirmed:z.literal(true),...revision}),
 z.object({action:z.literal('accept'),verified:z.literal(true),next:z.enum(['same','next']),...revision}),
 z.object({action:z.literal('cancel'),...revision}),
]);
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{guard(request);const{id}=await params;const p=await recover(await read(id));const bookmarkId=new URL(request.url).searchParams.get('bookmark');if(bookmarkId){const bookmark=p.bookmarks.find(b=>b.id===bookmarkId);if(!bookmark)throw new AppError('NOT_FOUND','书签不存在',404);const{stdout}=await exec('git',['archive','--format=tar',bookmark.commit],{cwd:workspace(id),encoding:'buffer',maxBuffer:100*1024*1024,timeout:30000});return new Response(new Uint8Array(stdout),{headers:{'Content-Type':'application/x-tar','Content-Disposition':`attachment; filename="bookmark-${bookmark.commit.slice(0,7)}.tar"`}});}return NextResponse.json(p);}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{guard(request,true);const{id}=await params;const input=schema.parse(await request.json());return NextResponse.json(await locked(id,async()=>{const p=await read(id);checkRevision(p,input.revision);if(input.action!=='archive'&&input.action!=='restore')requireActive(p);switch(input.action){
 case'archive':return setArchived(p,true);
 case'restore':return setArchived(p,false);
 case'analyze':return startAnalysis(p);
 case'answer':await answerQuestions(p,input.answers);return startAnalysis(p);
 case'supplement':await supplement(p,input.note);return startAnalysis(p);
 case'confirm_requirements':await confirmRequirements(p,input.requirementsHash);return startPlanning(p);
 case'plan':return startPlanning(p);
 case'revise':return revise(p,input.document);
 case'request_revision':await requestRevision(p,input.feedback);return startPlanning(p);
 case'confirm_document':return confirmDocument(p,input.version,input.docHash);
 case'bookmark':return checkpoint(p);
 case'develop':return start(p,input.version,input.docHash,input.bookmarkId);
 case'accept':await advance(p,input.next);return p.workflow==='planning'?startPlanning(p):p;
 case'cancel':return cancel(p);
}}));}catch(e){return errorResponse(e);}}
