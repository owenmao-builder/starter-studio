import type { AppData, Project } from './types';
import { previewApi } from './preview-api';
export const previewMode = process.env.NEXT_PUBLIC_STUDIO_PREVIEW === '1';
async function request<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{...options,headers:{'x-studio-request':'1',...options?.headers},cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new Error(data.error?.message || '请求失败，请重试');return data as T;
}
const localApi={
 list:()=>request<AppData>('/api/projects'),
 get:(id:string)=>request<Project>(`/api/projects/${id}`),
 upload:(file:File)=>{const body=new FormData();body.append('file',file);return request<Project>('/api/projects',{method:'POST',body});},
 action:(id:string,body:Record<string,unknown>)=>request<Project>(`/api/projects/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
};

export const api=previewMode?previewApi:localApi;
