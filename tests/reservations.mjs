import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role;');
const schema = (await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', '');
await db.exec(schema);
const items = (q,size='RN') => JSON.stringify([{size,quantity:q}]);
const create = (token,q,size='RN',name='Teste') => db.query('select public.create_reservation($1,$2,$3::jsonb) id',[name,token,items(q,size)]);
const available = async (size='RN') => (await db.query('select available from public.stock_public where size=$1',[size])).rows[0].available;
assert.equal((await db.query('select sum(total)::int total from public.diaper_stock')).rows[0].total,20);
assert.equal(await available('XG'),0);
await create('a',1);
assert.equal(await available(),1);
await assert.rejects(create('b',2), /insufficient_stock/);
assert.equal(await available(),1);
await db.query('select public.update_reservation($1,$2::jsonb)', ['a',items(2)]);
assert.equal(await available(),0);
await assert.rejects(create('b',1), /insufficient_stock/);
await assert.rejects(db.query('select public.update_reservation($1,$2::jsonb)', ['a',items(3)]), /insufficient_stock/);
assert.equal(await available(),0);
assert.equal((await db.query('select public.cancel_reservation($1) ok',['wrong'])).rows[0].ok,false);
assert.equal(await available(),0);
assert.equal((await db.query('select public.cancel_reservation($1) ok',['a'])).rows[0].ok,true);
assert.equal(await available(),2);
assert.equal((await db.query('select public.cancel_reservation($1) ok',['a'])).rows[0].ok,false);
assert.equal(await available(),2);
assert.equal((await db.query('select public.get_reservation($1)',['a'])).rows.length,0);
assert.equal((await db.query('select public.update_reservation($1,$2::jsonb) ok',['a',items(1)])).rows[0].ok,false);
for(const invalid of [null,{},[], [{size:'RN',quantity:0}], [{size:'RN',quantity:1},{size:'RN',quantity:1}], [{size:'XX',quantity:1}], [{size:'RN',quantity:1.5}], [{size:'RN',quantity:'1'}], [{size:'RN',quantity:-1}], [{size:'RN',quantity:101}], [{quantity:1}]]) {
 await assert.rejects(db.query('select public.create_reservation($1,$2,$3::jsonb)',['Teste','bad',JSON.stringify(invalid)]), /invalid_items/);
}
await assert.rejects(create('xg',1,'XG'), /insufficient_stock/);
await assert.rejects(create('short',1,'P','X'), /check constraint/);
const multi=JSON.stringify([{size:'RN',quantity:1},{size:'M',quantity:3},{size:'G',quantity:2},{size:'P',quantity:1}]);
await db.query('select public.create_reservation($1,$2,$3::jsonb)',['Teste','multi',multi]);
assert.equal(await available(),1);
const existing=(await db.query('select * from public.get_reservation($1)',['multi'])).rows[0];
assert.equal(existing.items.length,4);
await assert.rejects(db.query('select public.update_reservation($1,$2::jsonb)', ['multi',JSON.stringify([{size:'RN',quantity:1},{size:'M',quantity:8}])]), /insufficient_stock/);
assert.deepEqual((await db.query('select * from public.get_reservation($1)',['multi'])).rows[0],existing);
await db.query('select public.update_reservation($1,$2::jsonb)',['multi',items(1,'P')]);
assert.equal(await available('M'),7);
assert.equal(await available('G'),6);
assert.equal(await available('RN'),2);
// Anonymous and authenticated callers cannot read private data or execute privileged RPCs.
for(const role of ['anon','authenticated']) {
 await db.exec(`set role ${role};`);
 for(const table of ['reservations','reservation_items','diaper_stock','stock_public']) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
 await assert.rejects(create('forbidden',1), /permission denied/);
 await assert.rejects(db.query('select public.cancel_reservation($1)',['multi']), /permission denied/);
 await db.exec('reset role;');
}
// Applying the new targets preserves a real reservation and is repeatable.
const migration=await readFile(new URL('../supabase/migrations/20261102_laura_targets.sql', import.meta.url),'utf8');
await db.exec(migration); await db.exec(migration);
assert.equal((await db.query('select * from public.get_reservation($1)',['multi'])).rows[0].items[0].quantity,1);
// When reservations exceed a new target, the whole migration must roll back.
await db.exec("update public.diaper_stock set total=10 where size='RN';");
await create('above',3);
await assert.rejects(db.exec(migration), /reservas acima das novas metas/);
await db.exec('rollback;');
assert.equal((await db.query("select total from public.diaper_stock where size='RN'")).rows[0].total,10);
assert.equal(await available(),7);
await db.query('select public.cancel_reservation($1)',['above']);
await db.exec(migration);
await db.query('select public.cancel_reservation($1)',['multi']);
assert.equal((await db.query('select sum(available)::int total from public.stock_public')).rows[0].total,20);
await db.close();
console.log('PASS: targets=20; four sizes; XG unavailable; validation; rollback; updates; cancellation; permissions; migration preserves reservations and refuses unsafe reductions.');
