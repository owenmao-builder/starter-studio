import type {Project} from './types';

export type StudioView = 'flow' | 'archive' | 'history';
export function readNavigation(search: string) {
 const params = new URLSearchParams(search);
 const value = params.get('view');
 const view:StudioView=value==='archive'?'archive':value==='history'||value==='projects'?'history':'flow';
 return {view,projectId:params.get('project')||null,newProject:params.get('new')==='1'};
}
export function navigationURL(pathname:string,view:StudioView,projectId?:string|null) {
 const params=new URLSearchParams();
 if(projectId)params.set('project',projectId);
 if(view!=='flow')params.set('view',view);
 else if(!projectId)params.set('new','1');
 return pathname+(params.size?`?${params}`:'');
}
// Looking at records must not switch the software selected for development.
export function resolveNavigation(projects:Project[],search:string,currentId:string|null) {
 const route=readNavigation(search);
 const current=projects.find(p=>p.id===currentId&&!p.archivedAt)||projects.find(p=>!p.archivedAt)||null;
 const selected=projects.find(p=>p.id===route.projectId)||null;
 if(selected?.archivedAt)return {view:'archive' as const,projectId:selected.id,currentId:current?.id||null};
 if(route.view==='flow'){
  const target=route.newProject?null:selected||current;
  return {view:route.view,projectId:target?.id||null,currentId:target?.id||current?.id||null};
 }
 return {view:route.view==='archive'&&selected?'history' as const:route.view,projectId:selected?.id||null,currentId:current?.id||null};
}
