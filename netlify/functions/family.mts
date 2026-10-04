import {getStore} from '@netlify/blobs';
import {handleFamily} from './_shared/family-handler.mjs';
export default async(req:Request)=>{try{return await handleFamily(req,getStore({name:'little-color-families-v1',consistency:'strong'}))}catch{return Response.json({error:'Family connection is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}};
export const config={path:'/api/family',method:['POST'],rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};
