import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(){ const {data,error}=await db().from('stock_public').select('size,total,reserved,available').order('sort_order');return NextResponse.json(error?{error:'Falha ao consultar estoque'}:data,{status:error?500:200,headers:{'Cache-Control':'no-store'}}); }
