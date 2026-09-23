import { useId, type ReactNode } from 'react'
export function PageTabs({items,value,onChange,label='Seções'}:{items:{id:string;label:string;icon?:ReactNode}[];value:string;onChange:(id:string)=>void;label?:string}) {
  const prefix=useId()
  return <div className="page-tabs" role="tablist" aria-label={label}>{items.map((item,i)=><button key={item.id} id={`${prefix}-${item.id}`} type="button" role="tab" aria-selected={value===item.id} tabIndex={value===item.id?0:-1} onClick={()=>onChange(item.id)} onKeyDown={event=>{let next:number;if(event.key==='ArrowRight')next=(i+1)%items.length;else if(event.key==='ArrowLeft')next=(i+items.length-1)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();onChange(items[next].id);document.getElementById(`${prefix}-${items[next].id}`)?.focus()}}>{item.icon}<span>{item.label}</span></button>)}</div>
}
