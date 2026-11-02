import { NextRequest,NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import {newToken,hashToken} from '../../../lib/token';
export async function POST(req:NextRequest){
 try { const body=await req.json(); const name=body.name; const items=body.items;
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>80||!Array.isArray(items)||items.length<1||items.length>5||items.some((x:any)=>!x||!['RN','P','M','G','XG'].includes(x.size)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>100)||new Set(items.map((x:any)=>x.size)).size!==items.length)return NextResponse.json({error:'Dados inválidos'},{status:400});
 const token=newToken();const {error}=await db().rpc('create_reservation',{p_name:name.trim(),p_token_hash:hashToken(token),p_items:items});
 if(error)return NextResponse.json({error:error.message.includes('insufficient_stock')?'Estoque insuficiente. Atualize a lista.':'Não foi possível reservar.'},{status:error.message.includes('insufficient_stock')?409:500});
 return NextResponse.json({token},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Requisição inválida'},{status:400})}
}
