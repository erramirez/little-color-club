import {getStore} from '@netlify/blobs';
import {handleArt} from './_shared/art-handler.mjs';
export default async (req: Request, context: {requestId?: string}) => {
  try {
    return await handleArt(req,
      getStore({name: 'little-color-art-v2', consistency: 'strong'}),
      getStore({name: 'little-color-families-v1', consistency: 'strong'}));
  } catch {
    console.error('art_storage_unavailable', context?.requestId || 'unknown');
    return Response.json({error: 'Artwork sync is temporarily unavailable.'},
      {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
};
export const config = {path: '/api/art', method: ['GET', 'PUT'],
  rateLimit: {windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain']}};
