import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {hashToken,validToken} from '../../../../lib/token';
export async function POST(req:NextRequest){
 try {const body=await req.json();if(!validToken(body.token))return NextResponse.json({error:'Código inválido'},{status:400});
 if(body.action==='get'){const {data,error}=await db().rpc('get_reservation',{p_token_hash:hashToken(body.token)});if(error)return NextResponse.json({error:'Não foi possível consultar sua reserva. Tente novamente.'},{status:500});if(!data||!data.length)return NextResponse.json({error:'Reserva não encontrada'},{status:404});return NextResponse.json(data[0],{headers:{'Cache-Control':'no-store'}})}
 if(body.action==='cancel'){const {data,error}=await db().rpc('cancel_reservation',{p_token_hash:hashToken(body.token)});if(error)return NextResponse.json({error:'Não foi possível cancelar. Tente novamente.'},{status:500});if(!data)return NextResponse.json({error:'Reserva não encontrada ou já cancelada'},{status:404});return NextResponse.json({ok:true})}
 if(body.action==='update'){const items=body.items;if(!Array.isArray(items)||items.length<1||items.length>5||items.some((x:any)=>!x||!['RN','P','M','G','XG'].includes(x.size)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>100)||new Set(items.map((x:any)=>x.size)).size!==items.length)return NextResponse.json({error:'Itens inválidos'},{status:400});const {data,error}=await db().rpc('update_reservation',{p_token_hash:hashToken(body.token),p_items:items});if(error)return NextResponse.json({error:error.message.includes('insufficient_stock')?'Estoque insuficiente':'Não foi possível alterar'},{status:error.message.includes('insufficient_stock')?409:500});if(!data)return NextResponse.json({error:'Reserva não encontrada ou já cancelada'},{status:404});return NextResponse.json({ok:true})}
 return NextResponse.json({error:'Ação inválida'},{status:400});
 }catch{return NextResponse.json({error:'Requisição inválida'},{status:400})}
}
