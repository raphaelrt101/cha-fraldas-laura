// Exercise the actual Next.js route handlers against the SQL fixture.
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const fixture=spawn(process.execPath,[new URL('./mock-supabase.mjs',import.meta.url).pathname],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{fixture.stdout.on('data',data=>{if(String(data).includes('listening'))resolve();});fixture.on('exit',()=>reject(new Error('Test fixture failed')));});
const require=createRequire(import.meta.url);
process.env.SUPABASE_URL='http://127.0.0.1:54329';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
const temporary=new URL('../.qa-compiled/',import.meta.url);
const paths=['app/api/stock/route.ts','app/api/reservations/route.ts','app/api/reservations/manage/route.ts','lib/db.ts','lib/token.ts'];
const controls=async body=>fetch('http://127.0.0.1:54329/__control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
await controls({action:'reset'});
for(const path of paths){
 const text=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const target=new URL(path.replace(/\.ts$/,'.js'),temporary);
 await mkdir(new URL('.',target),{recursive:true});
 await writeFile(target,ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
const {NextRequest}=require('next/server');
const stock=require(new URL('app/api/stock/route.js',temporary).pathname);
const create=require(new URL('app/api/reservations/route.js',temporary).pathname);
const manage=require(new URL('app/api/reservations/manage/route.js',temporary).pathname);
const request=(handler,body)=>handler.POST(new NextRequest('https://test.invalid/api/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}));
const createBody=(items,name='Pessoa de teste')=>({name,items});
const rn=q=>[{size:'RN',quantity:q}];
let checks=0;
async function expectStatus(response,status){assert.equal(response.status,status,await response.clone().text());checks++;return response.json();}
try {
 const response=await stock.GET();assert.equal(response.headers.get('cache-control'),'no-store');
 const initial=await expectStatus(response,200);assert.equal(initial.reduce((sum,x)=>sum+x.total,0),20);
 for(const body of ['{',null,{},createBody([]),createBody(rn(0)),createBody(rn(1.2)),createBody([{size:'XX',quantity:1}]),createBody(rn(1),'X'),createBody(rn(1),'x'.repeat(81)),createBody([{size:'P',quantity:1},{size:'P',quantity:1}])]) await expectStatus(await request(create,body),400);
 const created=await expectStatus(await request(create,createBody([{size:'P',quantity:1},{size:'M',quantity:2}],'  Nome com acento Á  ')),201);
 assert.match(created.token,/^[a-f0-9]{64}$/);
 const t=created.token;
 const get=await expectStatus(await request(manage,{action:'get',token:t}),200);assert.equal(get.name,'Nome com acento Á');assert.equal(get.items.length,2);
 await expectStatus(await request(manage,{action:'update',token:t,items:[{size:'P',quantity:2},{size:'G',quantity:1}]}),200);
 await expectStatus(await request(manage,{action:'update',token:t,items:[{size:'M',quantity:8}]}),409);
 const unchanged=await expectStatus(await request(manage,{action:'get',token:t}),200);assert.equal(unchanged.items.find(x=>x.size==='P').quantity,2);
 for(const body of [null,{}, {action:'get',token:'bad'}, {action:'unknown',token:t}, {action:'update',token:t,items:[]}]) await expectStatus(await request(manage,body),400);
 await expectStatus(await request(manage,{action:'cancel',token:'0'.repeat(64)}),404);
 await expectStatus(await request(manage,{action:'cancel',token:t}),200);
 await expectStatus(await request(manage,{action:'cancel',token:t}),404);
 await expectStatus(await request(manage,{action:'get',token:t}),404);
 await expectStatus(await request(manage,{action:'update',token:t,items:rn(1)}),404);
 // Simultaneous HTTP-handler calls compete for all remaining RN packages.
 const contenders=await Promise.all([request(create,createBody(rn(2))),request(create,createBody(rn(2)))]);
 assert.deepEqual(contenders.map(r=>r.status).sort(),[201,409]);checks+=2;
 const winner=await contenders.find(r=>r.status===201).json();
 await expectStatus(await request(create,createBody(rn(1))),409);
 // Concurrent cancellation can release the stock only once.
 const cancellations=await Promise.all([request(manage,{action:'cancel',token:winner.token}),request(manage,{action:'cancel',token:winner.token})]);
 assert.deepEqual(cancellations.map(r=>r.status).sort(),[200,404]);checks+=2;
 assert.deepEqual(await (await stock.GET()).json(),initial);
 await controls({action:'offline',value:true});
 await expectStatus(await stock.GET(),500);
 await expectStatus(await request(create,createBody(rn(1))),500);
 await expectStatus(await request(manage,{action:'get',token:'a'.repeat(64)}),500);
 await expectStatus(await request(manage,{action:'cancel',token:'a'.repeat(64)}),500);
 await expectStatus(await request(manage,{action:'update',token:'a'.repeat(64),items:rn(1)}),500);
 console.log(`PASS: ${checks} API checks; malformed requests, names, multi-size reservations, secret tokens, no-store, update rollback, invalid/cancelled tokens, concurrent reservations and cancellations, database outage.`);
}finally{await controls({action:'reset'});await rm(temporary,{recursive:true,force:true});fixture.kill();}
