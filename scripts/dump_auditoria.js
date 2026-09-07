const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'.env.test'});
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
const allowed={
  v10:new Set(['INSERT','UPDATE','DELETE','STATUS_CHANGE','LOGIN','LOGOUT','APPROVAL','REJECTION','STOCK_ENTRY','STOCK_EXIT','STOCK_ADJUSTMENT','MEMBERSHIP_CHANGE','ROLE_CHANGE','QR_REGENERATED','TRIAGEM','OS_CONCLUIDA','CHECKLIST_CONCLUIDA','FOTO_ADICIONADA','COST_ADDED']),
  v11:new Set(['INSERT','UPDATE','DELETE','STATUS_CHANGE','LOGIN','LOGOUT','APPROVAL','REJECTION','STOCK_ENTRY','STOCK_EXIT','STOCK_ADJUSTMENT','MEMBERSHIP_CHANGE','ROLE_CHANGE','QR_REGENERATED','TRIAGEM','OS_CREATED','OS_CONCLUIDA','CHECKLIST_CONCLUIDA','FOTO_ADICIONADA','COST_ADDED','STOCK_CONSUMED']),
  v14:new Set(['INSERT','UPDATE','DELETE','STATUS_CHANGE','LOGIN','LOGOUT','APPROVAL','REJECTION','STOCK_ENTRY','STOCK_EXIT','STOCK_ADJUSTMENT','MEMBERSHIP_CHANGE','ROLE_CHANGE','QR_REGENERATED','TRIAGEM','OS_CREATED','OS_CONCLUIDA','CHECKLIST_CONCLUIDA','FOTO_ADICIONADA','COST_ADDED','STOCK_CONSUMED']),
};
(async()=>{
  const{data}=await s.from('auditoria_logs').select('acao').limit(1000);
  const counts={};for(const r of data)counts[r.acao]=(counts[r.acao]||0)+1;
  for(const [k,v] of Object.entries(allowed)){
    const bad=Object.entries(counts).filter(([a])=>!v.has(a));
    console.log(`v${k} quebraria:`,bad.length?bad:'OK');
  }
  console.log('Total linhas:',Object.values(counts).reduce((a,b)=>a+b,0));
})();
