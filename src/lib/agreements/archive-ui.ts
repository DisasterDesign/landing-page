import type {ArchiveView} from './archive-policy';
export function archiveViewUrl(current:string,view:ArchiveView):string {
 const url=new URL(current);
 if(view==='active')url.searchParams.delete('archive');else url.searchParams.set('archive',view);
 return url.pathname+url.search+url.hash;
}
export function selectedArchiveTickets(rows:Array<{id:string;eligible:boolean;ticket:string|null}>,selected:Set<string>):string[]{
 return rows.filter(a=>selected.has(a.id)&&a.eligible&&a.ticket).slice(0,50).map(a=>a.ticket!);
}

export function quoteWorkingVisible(quote:{agreementStatus:string;archiveProtected?:boolean},showCancelled:boolean):boolean {
 return showCancelled||quote.agreementStatus!=='CANCELLED'||quote.archiveProtected===true;
}
