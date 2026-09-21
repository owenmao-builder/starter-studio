export type StudioView = 'flow' | 'projects' | 'history';
export function readNavigation(search: string): {view: StudioView; projectId: string | null} {
 const params = new URLSearchParams(search);
 const value = params.get('view');
 return {view: value === 'projects' || value === 'history' ? value : 'flow', projectId: params.get('project') || null};
}
export function navigationURL(pathname: string, view: StudioView, projectId?: string | null) {
 const params = new URLSearchParams();
 if (projectId) params.set('project', projectId);
 if (view !== 'flow') params.set('view', view);
 return pathname + (params.size ? `?${params}` : '');
}
