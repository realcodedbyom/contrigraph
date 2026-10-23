import {Member} from '@/lib/types';
export function Avatar({member,size=''}:{member?:Member;size?:string}){return <span className={`avatar ${size}`} style={{background:member?.color||'#e6e9df'}} title={member?.name}>{member?.initials||member?.name.split(' ').map(s=>s[0]).join('').slice(0,2)||'?'}</span>;}
export function Pill({children,tone='neutral'}:{children:React.ReactNode;tone?:string}){return <span className={`pill ${tone}`}><i/>{children}</span>;}
export function PanelHeader({title,description,action}:{title:React.ReactNode;description?:string;action?:React.ReactNode}){return <div className="panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;}
