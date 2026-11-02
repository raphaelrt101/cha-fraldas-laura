// Test fixture only. Never used by the deployed application.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role;');
await db.exec((await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
let offline=false;
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 try {
  let body=''; for await(const chunk of req) body+=chunk;
  const params=body ? JSON.parse(body) : {};
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/__control') {
   if(params.action==='reset') {await db.exec('truncate public.reservation_items,public.reservations;'); offline=false;}
   if(params.action==='offline') offline=Boolean(params.value);
   res.end(JSON.stringify({ok:true}));return;
  }
  if(offline) {res.statusCode=503;res.end(JSON.stringify({message:'Test outage'}));return;}
  if(req.headers.apikey!=='test-service-key') {res.statusCode=401;res.end(JSON.stringify({message:'Invalid API key'}));return;}
  if(path==='/rest/v1/stock_public') {res.end(JSON.stringify((await db.query('select size,total,reserved,available from public.stock_public order by sort_order')).rows));return;}
  const fn=path.split('/').pop();
  let result;
  if(fn==='create_reservation') result=(await db.query('select public.create_reservation($1,$2,$3::jsonb) value',[params.p_name,params.p_token_hash,JSON.stringify(params.p_items)])).rows[0].value;
  else if(fn==='get_reservation') result=(await db.query('select * from public.get_reservation($1)',[params.p_token_hash])).rows;
  else if(fn==='update_reservation') result=(await db.query('select public.update_reservation($1,$2::jsonb) value',[params.p_token_hash,JSON.stringify(params.p_items)])).rows[0].value;
  else if(fn==='cancel_reservation') result=(await db.query('select public.cancel_reservation($1) value',[params.p_token_hash])).rows[0].value;
  else {res.statusCode=404;result={message:'Not found'};}
  res.end(JSON.stringify(result));
 }catch(error){res.statusCode=400;res.end(JSON.stringify({message:error.message,code:error.code}));}
});
server.listen(54329,'0.0.0.0',()=>console.log('Test Supabase fixture listening on port 54329'));
