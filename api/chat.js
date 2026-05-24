// /api/chat.js — 손톱서점 마음방 v2.1
// Pinecone 라이아 v2 통합 임베딩 + Claude API
// OpenAI 불필요 — Pinecone이 텍스트 → 벡터 변환을 직접 처리
//
// 환경변수 필요:
//   ANTHROPIC_API_KEY   — Anthropic API 키
//   PINECONE_API_KEY    — Pinecone API 키
//   (PINECONE_INDEX_URL은 코드에 직접 고정)

const PINECONE_HOST = 'https://sontop-data-dj6kb5u.svc.aped-4627-b74a.pinecone.io';

// ── 위기 감지 ──
const CRISIS_KEYWORDS = [
  '죽고 싶', '자살', '자해', '끝내고 싶', '사라지고 싶',
  '더 이상 살기 싫', '죽어버리고', '목숨을 끊'
];

function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(kw => text.includes(kw));
}

// ── Pinecone 라이아 v2 검색 ──
// 라이아 v2는 텍스트를 직접 넣으면 Pinecone이 알아서 벡터로 변환해줌
// OpenAI 임베딩 API 호출 불필요
async function searchPinecone(userMessage, pineconeApiKey) {
  try {
    const response = await fetch(`${PINECONE_HOST}/records/namespaces/default/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': pineconeApiKey,
        'X-Pinecone-API-Version': '2025-01'
      },
      body: JSON.stringify({
        query: {
          inputs: { text: userMessage },  // 텍스트 직접 입력 (라이아 v2 방식)
          top_k: 5
        },
        fields: ['text', 'title', 'category', 'source']  // 가져올 메타데이터
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Pinecone 오류:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const hits = data.result?.hits || [];

    if (hits.length === 0) return null;

    // 검색된 내용을 Claude에게 넘길 텍스트로 조합
    const relevantContent = hits
      .filter(hit => hit._score > 0.4)  // 유사도 40% 이상만
      .map((hit, i) => {
        const text = hit.fields?.text || '';
        const title = hit.fields?.title || '수필';
        const category = hit.fields?.category || '';
        const source = hit.fields?.source || '';
        return `[참고자료 ${i + 1}] ${title} ${category ? `(${category})` : ''} ${source ? `— ${source}` : ''}\n${text}`;
      })
      .join('\n\n---\n\n');

    return relevantContent || null;

  } catch (error) {
    console.error('Pinecone 검색 실패:', error.message);
    return null;  // 실패해도 서비스는 계속 작동
  }
}

// ── 117개 코칭 질문 ──
const COACHING_QUESTIONS = [
  '지금 당신의 손에 꽉 쥐고 있어서 오히려 당신을 아프게 하는 것은 무엇인가요?',
  '내 것이 아닌데 내 것이라고 착각하며 살아온 마음의 짐이 있나요?',
  '오늘 딱 하나만 내 삶에서 방생할 수 있다면, 무엇을 놓아주고 싶으신가요?',
  '진짜 나로 살지 못하게 방해하는 목소리는 무엇인가요?',
  '당신의 삶에서 가장 정성스럽게 깎아내고 싶은 마음의 옹이는 무엇인가요?',
  '지금 멈춘 건가요, 쉬는 건가요?',
  '당신이 가장 두려워하는 그것, 한 번도 마주한 적 없지 않나요?',
  '지금 당신 안에서 부딪히고 있는 두 마음은 무엇인가요?',
  '당신이 반복하는 그 패턴, 어디서 배운 것입니까?',
  '지금 당신 삶에서 가장 많은 에너지를 빼앗아 가는 것은 무엇인가요?',
  '오늘 하루에서 가장 "나다웠던" 순간은 언제였나요?',
  '지금 이 순간, 당신의 마음은 자유롭습니까?',
  '깎이고 깎여 남은 단 하나의 진실— 그것이 당신에게는 무엇인가요?',
  '모든 것을 내려놓았을 때, 마지막까지 남아있는 당신의 진짜 모습은 무엇인가요?',
  '당신은 지금 무엇을 붙잡고 있나요?',
  '지금 당신을 무겁게 만드는 것, 정말 당신의 것인가요?',
  '숨을 내쉴 때, 당신은 무엇을 내보내고 있나요?',
  '지금 이것. 놓을 수 있습니까?',
  '지금 당신의 고통은 저항입니까, 아니면 신호입니까?',
  '당신이 세상에 놓아준 그 마음, 언젠가 당신에게 돌아오지 않을까요?'
];

// ── 시스템 프롬프트 ──
function buildSystemPrompt(relevantContent) {
  const contentSection = relevantContent
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【이 질문과 관련된 수필·시·코칭 자료 (Pinecone 검색 결과)】
아래 자료에서 영감을 받되, 문장을 그대로 쓰지 않는다.
반드시 이 사람 상황에 맞게 각색해서 녹여낸다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${relevantContent}`
    : '\n\n【참고】관련 자료 없음. 웃네 씨의 일반 철학으로 답변.';

  return `당신은 '웃네의 마음 문답' AI입니다.
목수·시인·코치·명상가 박의섭(필명: 웃네) 씨의 철학으로 고민에 답합니다.
핵심 철학: SSF(느리게·단순하게·자유롭게), "지금 이것(Just This)", 덜어냄의 미학

【웃네 씨 말투와 결】
- "그렇잖아요", "그거야", "그지", "그런 거지" 같은 구어체
- "옴팍", "찰라찰라", "그냥 그대로" 같은 고유 표현
- 나무 깎기, 씨앗과 꽃, 급류, 이정표, 발효 움, 촛불 비유 즐김
- 담담하고 직접적. 과잉 위로 없이
- 설교하거나 가르치지 않는다. 가리킬 뿐이다

【답변 구조 — 반드시 이 순서로, 각 단계 앞에 제목 표시】

**1단계 — 철학적 통찰**
검색된 자료에서 이 사람 상황에 맞는 내용을 찾아 웃네 씨의 언어로 새로 쓴다.
3~5문장. 문장을 그대로 붙여넣지 않는다.

**2단계 — 명상적 접근**
발효 움, 렌즈, 촛불, 새총 탄성, 이정표, 씨앗 같은 비유로
지금 이 마음을 어떻게 바라볼 것인지 가리킨다. 3~4문장.

**3단계 — 코칭 질문**
아래 질문 중 이 상황에 가장 맞는 것 하나로 마무리한다.
답을 주지 않는다. 질문으로 끝낸다.

코칭 질문 목록:
${COACHING_QUESTIONS.join('\n')}

【절대 금지】
- 자료 문장 그대로 복붙
- 심리 치료 흉내
- "괜찮아요, 잘하고 있어요" 식 공허한 위로
- 답을 주는 것 (항상 질문으로 마무리)
- 이 서비스가 심리 치료가 아님을 잊지 말 것
${contentSection}`;
}

// ── 재시도 (529 과부하 대응) ──
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 529 && attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
      continue;
    }
    return response;
  }
}

// ── 메인 핸들러 ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 요청입니다.' });
  }

  const { message } = req.body;

  if (!message || message.trim().length < 3) {
    return res.status(400).json({ error: '질문을 입력해 주세요.' });
  }

  // 위기 감지
  if (detectCrisis(message)) {
    return res.status(200).json({
      crisis: true,
      message: '지금 많이 힘드시겠습니다. 혼자 감당하지 않아도 됩니다.\n\n자살예방상담전화: 1393 (24시간)\n정신건강위기상담전화: 1577-0199'
    });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;

  if (!anthropicApiKey) {
    return res.status(500).json({ error: 'API 설정 오류입니다.' });
  }

  try {
    // Pinecone RAG 검색
    let relevantContent = null;
    if (pineconeApiKey) {
      relevantContent = await searchPinecone(message, pineconeApiKey);
      console.log('RAG:', relevantContent ? `${relevantContent.length}자 검색됨` : '결과 없음');
    }

    // Claude 호출
    const claudeResponse = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: buildSystemPrompt(relevantContent),
          messages: [{ role: 'user', content: message }]
        })
      }
    );

    if (!claudeResponse.ok) {
      const errData = await claudeResponse.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP_${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const replyText = claudeData.content?.[0]?.text;

    if (!replyText) throw new Error('빈 응답');

    // 응답 파싱
    const sections = parseResponse(replyText);

    return res.status(200).json({
      crisis: false,
      insight: sections.insight,
      meditation: sections.meditation,
      question: sections.question,
      raw: replyText,
      ragUsed: !!relevantContent
    });

  } catch (error) {
    console.error('오류:', error.message);
    return res.status(500).json({ error: '잠시 후 다시 시도해 주세요.' });
  }
}

// ── 응답 파싱 (3단계 구조 분리) ──
function parseResponse(text) {
  return {
    insight: extractSection(text, ['1단계', '철학적 통찰']),
    meditation: extractSection(text, ['2단계', '명상적 접근']),
    question: extractSection(text, ['3단계', '코칭 질문'])
  };
}

function extractSection(text, markers) {
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const start = text.indexOf('\n', idx) + 1;
    const end = findNextSectionStart(text, start);
    const content = text.slice(start, end).trim();
    if (content) return content;
  }
  return text.trim();
}

function findNextSectionStart(text, from) {
  const stops = ['**2단계', '**3단계', '\n\n---', '2단계 —', '3단계 —'];
  let earliest = text.length;
  for (const s of stops) {
    const idx = text.indexOf(s, from);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  return earliest;
}
