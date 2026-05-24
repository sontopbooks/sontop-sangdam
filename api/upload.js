// /api/upload.js

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_HOST = "https://sontop-data-dj6kb5u.svc.aped-4627-b74a.pinecone.io";

async function upsertBatch(records) {
  const response = await fetch(`${PINECONE_HOST}/records/namespaces/default/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
      'X-Pinecone-API-Version': '2025-01'
    },
    body: JSON.stringify({
      records: records.map(r => ({
        id: r.id,
        text: r.text,
        source: r.source
      }))
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinecone 오류 ${response.status}: ${err.slice(0, 300)}`);
  }
  return response.status;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다' });

  const { secret, records, batch } = req.body;

  if (secret !== process.env.UPLOAD_SECRET) return res.status(403).json({ error: '비밀키가 틀렸습니다' });
  if (!PINECONE_API_KEY) return res.status(500).json({ error: 'PINECONE_API_KEY가 없습니다' });
  if (!records || !Array.isArray(records)) return res.status(400).json({ error: 'records 배열이 필요합니다' });

  try {
    await upsertBatch(records);
    return res.status(200).json({ ok: true, batch, count: records.length, message: `배치 ${batch} 업로드 완료 (${records.length}개)` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
