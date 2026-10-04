import {getStore} from '@netlify/blobs';
import {handleArt} from './_shared/art-handler.mjs';
export default async (req:Request)=>{try{return await handleArt(req,getStore({name:'little-color-art-v2',consistency:'strong'}))}catch{return Response.json({error:'Artwork sync is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}};
export const config={path:'/api/art',method:['GET','PUT']};
