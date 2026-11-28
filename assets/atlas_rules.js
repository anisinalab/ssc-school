'use strict';
(()=>{
 function requiredComplete(ids,lessons,completed){return Array.isArray(ids)&&ids.length>0&&ids.every(id=>lessons.some(l=>l.id===id&&l.available)&&completed.has(id));}
 function derive(config,snapshot){
  const {lessons,completed}=snapshot,route=config.route||{},required=route.required_lesson_ids||[];
  const keys=(route.halls||[]).map(h=>{const r=h.key.rule;let ids=[];
   if(r.type==='module_complete')ids=lessons.filter(l=>l.moduleId===r.module_id).map(l=>l.id);
   if(r.type==='lessons_complete')ids=r.lesson_ids||[];
   if(r.type==='all_required_complete')ids=required;
   return {...h.key,moduleId:h.module_id,earned:r.type!=='none'&&requiredComplete(ids,lessons,completed),ids,done:ids.filter(id=>lessons.some(l=>l.id===id&&l.available)&&completed.has(id)).length};
  });
  return {keys,master:route.master_enabled===true&&requiredComplete(required,lessons,completed),required,done:required.filter(id=>lessons.some(l=>l.id===id&&l.available)&&completed.has(id)).length};
 }
 const api={derive,requiredComplete};globalThis.SscAtlasRules=api;if(typeof module!=='undefined')module.exports=api;
})();
