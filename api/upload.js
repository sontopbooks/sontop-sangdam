// /api/upload.js
// Pinecone에 손톱서점 데이터를 업로드하는 일회성 API
// 업로드 완료 후 이 파일은 삭제해도 됩니다

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_HOST = "https://sontop-data-dj6kb5u.svc.aped-4627-b74a.pinecone.io";

// 텍스트를 조각으로 나누기
function chunkText(text, chunkSize = 600, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 80) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}

function makeId(source, idx, text) {
  const key = `${source}_${idx}_${text.slice(0, 20)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return `${source}_${idx}_${Math.abs(hash).toString(36)}`;
}

// Pinecone에 배치 upsert
async function upsertBatch(records) {
  const response = await fetch(`${PINECONE_HOST}/records/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
      'X-Pinecone-API-Version': '2025-04'
    },
    body: JSON.stringify({
      namespace: '__default__',
      records: records.map(r => ({
        _id: r.id,
        text: r.text,
        source: r.source
      }))
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinecone 오류 ${response.status}: ${err}`);
  }
  return await response.json();
}

// 파일 내용 (Vercel 환경변수로 넣기 어려우므로 API 호출 시 전달)
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용됩니다' });
  }

  // 간단한 비밀키 체크
  const { secret, records, batch } = req.body;
  if (secret !== process.env.UPLOAD_SECRET) {
    return res.status(403).json({ error: '비밀키가 틀렸습니다' });
  }

  if (!PINECONE_API_KEY) {
    return res.status(500).json({ error: 'PINECONE_API_KEY가 없습니다' });
  }

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'records 배열이 필요합니다' });
  }

  try {
    await upsertBatch(records);
    return res.status(200).json({
      ok: true,
      batch: batch,
      count: records.length,
      message: `배치 ${batch} 업로드 완료 (${records.length}개)`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
