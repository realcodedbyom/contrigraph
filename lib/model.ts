export type Status = 'To do' | 'In progress' | 'In review' | 'Done';
export type Member = { id: string; name: string; initials: string; role: string; capacity: number; skills: string[]; color: string };
export type Task = { id: string; title: string; description: string; owner: string; effort: number; remaining: number; status: Status; priority: 'High' | 'Medium' | 'Low'; due: string; dependencies: string[]; skill: string; milestone: string; blocker?: string; release: number; comments: {author: string; text: string; time: string}[]; files: {name: string; url: string}[] };
export type Activity = { id: string; member: string; task: string; kind: 'created' | 'updated' | 'completed' | 'reviewed' | 'documented' | 'unblocked' | 'reassigned' | 'commented' | 'approved'; text: string; time: string };
export type Project = {name: string; description: string; deadline: string; tasks: Task[]; members: Member[]; activity: Activity[]};
export const TODAY = '2026-10-23';
export const dayDiff = (date: string, from = TODAY) => Math.ceil((Date.parse(date+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
export const formatDate = (date: string) => new Date(date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export function dateAfter(days: number) { const d = new Date(TODAY+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+Math.ceil(days)); return d.toISOString().slice(0,10); }
