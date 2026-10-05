#!/bin/sh
# Summarise "n8n execute --rawOutput" JSON from stdin: per node item counts plus ids/titles only.
node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const i=s.indexOf("{");
 if(i<0){console.log("NO JSON:",s.slice(-1500));return;}
 let d; try{d=JSON.parse(s.slice(i));}catch(e){console.log("PARSE FAIL",s.slice(0,1500));return;}
 const rd=(d.data&&d.data.resultData)||d.resultData||d;
 if(rd.error) console.log("WORKFLOW ERROR:",rd.error.message, rd.error.description||"");
 for(const [node,runs] of Object.entries(rd.runData||{})){
   for(const run of runs){
     if(run.error){console.log(node,"ERROR:",run.error.message,"|",run.error.description||"");continue;}
     const items=(run.data&&run.data.main&&run.data.main[0])||[];
     console.log(node,"->",items.length,"items");
     for(const it of items.slice(0,6)){const j=it.json;console.log("   ",JSON.stringify({id:j.id,title:j.title,company:j.company,country:j.country,remote:j.remote,slug:j.slug,name:j.name,plan:j.plan,status:j.status,max_page_size:j.limits&&j.limits.max_page_size,change:j.change,job_id:j.job&&j.job.id,job_title:j.job&&j.job.title,has_description:typeof j.description==="string"?j.description.length+" chars":undefined,error:j.error}));}
   }
 }
});'
