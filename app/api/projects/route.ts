import { NextResponse } from 'next/server';
import { createProject, list, AppError, locked } from '@/lib/store';
import { parseUpload } from '@/lib/upload';
import { runnerInfo, recover, startAnalysis } from '@/lib/runner';
import { guard,errorResponse } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{guard(request);const [projects,runner]=await Promise.all([list(),runnerInfo()]);return NextResponse.json({projects:await Promise.all(projects.map(recover)),runner:{available:runner.available,name:runner.name}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{guard(request,true);const data=await request.formData();const file=data.get('file');if(!(file instanceof File))throw new AppError('MISSING_FILE','请选择 PRD 文件');const {filename,text}=await parseUpload(file);const project=await createProject(filename,text);return NextResponse.json(await locked(project.id,()=>startAnalysis(project)),{status:201});}catch(e){return errorResponse(e);}}
