interface Forecast {
 bottomLine:{totalMrr:number;netProfit:number};
 books:{personal?:{amount:number;profit:number;count:number};fuzion:{amount:number;profit:number;count:number}};
 settlement:{royEntitlement:number};myProfit:number;
}
/** Recurring ownership follows the finance book, never the salesperson. Forecast only. */
export function partnerForecastFigures(isOwner:boolean,sharePct:number|null,report:Forecast){
 if(isOwner)return {gross:report.bottomLine.totalMrr,profit:report.bottomLine.netProfit,payout:report.myProfit,clientCount:(report.books.personal?.count??0)+report.books.fuzion.count};
 if(sharePct===null)return null;
 return {gross:report.books.fuzion.amount,profit:report.books.fuzion.profit,payout:report.settlement.royEntitlement,clientCount:report.books.fuzion.count};
}
