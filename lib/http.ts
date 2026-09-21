import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './store';
export function guard(request:Request,mutation=false){
 const host=request.headers.get('host') || '';
 if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))throw new AppError('LOCAL_ONLY','工作台只允许本机访问',403);
 const origin=request.headers.get('origin');
 if(origin&&origin!==`http://${host}`)throw new AppError('INVALID_ORIGIN','请求来源不受信任',403);
 if(mutation&&request.headers.get('x-studio-request')!=='1')throw new AppError('INVALID_REQUEST','请从工作台发起操作',403);
 if(Number(request.headers.get('content-length')||0)>11*1024*1024)throw new AppError('FILE_TOO_LARGE','请求大小不能超过 11 MB',413);
}
export function errorResponse(error:unknown){
 if(error instanceof AppError)return NextResponse.json({error:{code:error.code,message:error.message}},{status:error.status});
 if(error instanceof ZodError)return NextResponse.json({error:{code:'INVALID_INPUT',message:'提交内容无效，请刷新后重试'}},{status:400});
 return NextResponse.json({error:{code:'INTERNAL_ERROR',message:'操作未完成，请重试。已有项目文件会保留。'}},{status:500});
}
