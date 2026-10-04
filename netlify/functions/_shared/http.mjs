export const respond = (data, status = 200) => Response.json(data, {status,
  headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
export const TOKEN = /^[a-f0-9]{64}$/;
export async function readJSON(req, limit) {
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(new Error('Invalid request.'), {status: 400});
  let length = 0, chunks = [];
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {await reader.cancel(); throw Object.assign(new Error('This request is too large.'), {status: 413});}
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let at = 0;
  for (const c of chunks) {bytes.set(c, at); at += c.length;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw Object.assign(new Error('Invalid JSON.'), {status: 400});}
}
