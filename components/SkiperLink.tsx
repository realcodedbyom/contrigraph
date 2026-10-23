import type {ReactNode} from 'react';
// Adapted from Skiper UI's free Link001 (skiper40), by @gurvinder-singh02.
// https://skiper-ui.com/v1/skiper40. Free personal/commercial use with attribution.
// Tailwind styling translated to project CSS. Original inspiration: cursor.com.
export default function SkiperLink({href,children}:{href:string;children:ReactNode}){return <a className="skiper-link" href={href} target="_blank" rel="noopener noreferrer">{children}<svg fill="none" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></a>;}
