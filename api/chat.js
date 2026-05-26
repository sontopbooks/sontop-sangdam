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

// ── 117개 코칭 질문 전체 ──
const COACHING_QUESTIONS = [
  '지금 당신의 손에 꽉 쥐고 있어서 오히려 당신을 아프게 하는 것은 무엇인가요?',
  '내 것이 아닌데 내 것이라고 착각하며 살아온 마음의 짐이 있나요?',
  '오늘 딱 하나만 내 삶에서 방생할 수 있다면, 무엇을 놓아주고 싶으신가요?',
  '비우면 비울수록 더 단단하게 채워지는 당신만의 가치는 무엇입니까?',
  '진짜 나로 살지 못하게 방해하는 목소리는 무엇인가요?',
  '세상의 속도를 따라가느라 놓쳐버린 당신 내면의 작고 소중한 진심은 어디에 있나요?',
  '당신의 삶에서 가장 정성스럽게 깎아내고 싶은 마음의 옹이는 무엇인가요?',
  '당신의 삶이 더 자연스럽게 흐르려면, 지금 무엇이 필요한가요?',
  '오늘 당신이 세상에 놓아준 선한 마음 하나가 있다면 무엇인가요?',
  '모든 것을 내려놓았을 때, 마지막까지 남아있는 당신의 진짜 모습은 무엇인가요?',
  '지금 쥐고 있는 그것, 정말 당신의 것입니까?',
  '내려놓을 때 비로소 보이기 시작하는 당신의 전체는 어떤 모습인가요?',
  '지금 애쓰고 있는 당신, 이미 충분히 괜찮지 않나요?',
  '버리는 것이 아닙니다. 본래의 자리로 돌려보내는 것— 지금 당신이 돌려보낼 것은 무엇인가요?',
  '오늘 하루에서 가장 나다웠던 순간은 언제였나요?',
  '지금 당신의 마음이 머무는 그곳, 문은 안에서 열릴 수 있지 않을까요?',
  '무엇이 되려 하지 마세요. 당신 안에 이미 힌트가 있지 않나요?',
  '당신이 세상에 놓아준 그 마음, 언젠가 당신에게 돌아오지 않을까요?',
  '지금 이 순간, 당신의 마음은 자유롭습니까?',
  '깎이고 깎여 남은 단 하나의 진실— 그것이 당신에게는 무엇인가요?',
  '단 하나, 지금 놓아주고 싶은 게 있다면?',
  '당신이 오래 붙잡고 있는 건 뭔가요?',
  '완성은 손에서 떠날 때입니다. 당신은 어떻게 생각하나요?',
  '108번 반복하고 싶은 게 있다면?',
  '작다는 이유로 포기한 적 있나요?',
  '지금 멈춘 건가요, 쉬는 건가요?',
  '당신이 세상에 돌려주고 싶은 게 있다면?',
  '자연이 당신에게 말을 건 적 있나요?',
  '지금 이것— 지금 이 순간 당신에게 진짜로 있는 것은 무엇인가요?',
  '지금 당신 손 안에 있는 것 중, 사실은 이미 떠날 준비가 된 게 있지 않나요?',
  '당신이 만들어온 것 중 가장 자랑스러운 건 무엇인가요?',
  '놓아준다는 건 포기가 아닙니다. 당신에게 놓아줌은 어떤 의미인가요?',
  '멈추지 않으면 실개천도 바다입니다. 지금 당신은 흐르고 있나요?',
  '작은 것이 세상을 바꾼 경험, 당신에게도 있지 않나요?',
  '지금 이 순간 자연에게 돌려주고 싶은 게 있다면?',
  '108번 반복할 만큼 당신 삶에서 소중한 게 뭔가요?',
  '나무 안에 이미 새가 있었습니다. 당신 안에는 무엇이 있나요?',
  '오늘 하루, 당신은 무엇을 깎아냈나요?',
  '오래 붙잡고 있는 것 중에, 사실은 이미 떠나보낼 준비가 된 게 있나요?',
  '당신에게 완성은 어떤 순간인가요? 다 됐을 때인가요, 아니면 손에서 떠날 때인가요?',
  '마지막으로 아무것도 안 하고 그냥 심심했던 게 언제예요?',
  '당신이 받은 것 중에, 언젠가 세상에 돌려줘야겠다고 생각해온 게 있나요?',
  '지금 당신 삶에 이름을 붙인다면 뭐라고 부르고 싶나요?',
  '지금 이 글을 읽고 있는 당신, 이 순간 마음에 걸리는 게 뭔가요?',
  '지금 붙잡고 있는 것은 정말 당신의 것입니까?',
  '놓아주면 지나갈 것인데, 왜 아직 붙잡고 있습니까?',
  '지금의 불안, 사실 당신의 것입니까?',
  '당신을 무겁게 하는 그 생각, 어디서 온 것입니까?',
  '지금 놓아주면 무엇이 가벼워집니까?',
  '붙잡고 있는 이유가 두려움입니까?',
  '놓아주면 당신은 무엇이 됩니까?',
  '지금 당신을 붙잡고 있는 것은 생각입니까, 사실입니까?',
  '이 감정은 지나가는 것 아닌가요?',
  '지금, 놓아볼 수 있을까요?',
  '지금 놓아주고 싶은 감정이 하나 있다면 무엇인가요?',
  '요즘 당신을 가장 붙잡고 있는 생각은 무엇인가요?',
  '지금 마음속에 조용히 보내주고 싶은 감정이 있나요?',
  '오늘 당신이 놓아주고 싶은 단어 하나는 무엇인가요?',
  '지금 당신을 무겁게 만드는 것, 정말 당신의 것인가요?',
  '놓아주면 가벼워질 것 같은 생각 하나는 무엇인가요?',
  '오늘 당신이 자연으로 돌려보내고 싶은 것은 무엇인가요?',
  '당신은 지금 무엇을 붙잡고 있나요?',
  '지금 이 순간 당신이 방생하고 싶은 것은 무엇인가요?',
  '당신은 그것을 쥐고 있습니다. 그런데 느껴지나요?',
  '느껴집니다. 하지만 꼭 붙잡아야 하나요?',
  '왔습니다. 이제 보내주시겠습니까?',
  '당신은 그것을 들고 있습니다. 왜인가요?',
  '지나갑니다. 허락하시겠습니까?',
  '붙잡고 있습니다. 놓아보면 어떨까요?',
  '지금 이것. 놓을 수 있습니까?',
  '지금 당신의 고통은 저항입니까, 아니면 신호입니까?',
  '당신이 가장 두려워하는 그것, 한 번도 마주한 적 없지 않나요?',
  '당신의 몸은 이미 알고 있습니다. 마음이 따라가고 있나요?',
  '숨을 내쉴 때, 당신은 무엇을 내보내고 있나요?',
  '만약 지금이 아주 소중한 순간이라면, 당신은 무엇을 놓아주겠습니까?',
  '당신이 반복하는 그 패턴, 어디서 배운 것입니까?',
  '지금 당신 안에서 부딪히고 있는 두 마음은 무엇인가요?',
  '비어있음이 두렵습니까? 아니면 채워진 후의 변화가 두렵습니까?',
  '지금 당신의 호흡은 얕습니까, 깊습니까?',
  '당신이 자신을 보호하기 위해 자신에게 하는 말은 무엇입니까?',
  '지금 당신 삶에서 가장 많은 에너지를 빼앗아 가는 것은 무엇인가요?',
  '당신이 진짜 원하는 것, 말한 적 있습니까?',
  '지금 당신의 침묵은 평화입니까, 회피입니까?',
  '당신이 가장 온전히 살아있다고 느끼는 순간은 언제입니까?',
  '지금 당신이 서 있는 이 자리, 당신이 선택한 자리입니까?',
  '당신의 삶에서 지금 가장 용기가 필요한 한 가지는 무엇인가요?',
  '이 글을 다 읽고 난 후 당신이 할 단 한 가지 행동은 무엇인가요?',
  '깎아내면 남는 것이 본질입니다. 당신의 본질은 무엇입니까?',
  '지금 당신을 붙잡고 있는 것은 기억입니까, 상상입니까?',
  '놓지 못하는 이유는 사라질까 두려워서인가요?',
  '지금 이 생각은 사실입니까, 해석입니까?',
  '지금 당신의 마음은 붙잡고 있습니까, 흐르고 있습니까?',
  '당신이 놓지 못하는 것, 정말 중요한 것입니까?',
  '지금의 긴장은 지켜야 해서입니까, 놓지 못해서입니까?',
  '이 생각이 없다면 당신은 더 자유로울까요?',
  '지금 이 감정은 머물고 싶어 합니까?',
  '놓아주면 무엇이 시작될까요?',
  '지금 당신은 익숙함에 있습니까, 새로운 시작 앞에 있습니까?',
  '지금 당신의 마음은 과거에 있습니까, 지금에 있습니까?',
  '당신이 붙잡고 있는 것, 당신에게 도움이 되고 있습니까?',
  '당신이 나라고 믿는 그 생각, 정말 당신입니까?',
  '비우는 것이 두렵습니까, 비워진 후의 자유가 두렵습니까?',
  '답을 찾으려 애쓰는 그 마음, 잠시 내려놓을 수 있습니까?',
  '당신은 지금 존재하고 있습니까, 아니면 애쓰고 있습니까?',
  '마음의 문턱을 넘지 못한 채 서성이는 진심은 무엇인가요?',
  '오늘 당신이 만난 풍경 중 당신의 마음을 닮은 것은 무엇입니까?',
  '애쓰지 않아도 해는 뜨고 나무는 자랍니다. 당신은요?',
  '당신이 버리지 못한 그 조각이 당신의 전체를 가리고 있지는 않나요?',
  '지금 이 고요함 속에서 당신은 무엇을 듣고 있습니까?',
  '지금 이 기억에서 한 발짝 물러서면, 무엇이 보이나요?',
  '가장 깊은 어둠 속에서만 보이는 당신의 빛은 무엇인가요?',
  '당신을 정의하는 모든 수식어를 떼어내면 무엇이 남습니까?',
  '세상의 기대를 방생할 때, 당신은 어디로 흐르고 싶나요?',
  '당신이 지키려 하는 그 자존심이 정말 당신을 지켜주고 있습니까?',
  '완성되지 않아도 괜찮습니다. 지금 당신에게 완성되지 않아도 되는 것은 무엇인가요?',
  '과거의 당신에게 건네고 싶은 단 하나의 용서는 무엇인가요?',
  '방생된 나무 조각처럼, 당신도 자유로워질 권리가 있지 않을까요?'
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
- 비유는 검색된 수필에서 자연스럽게 끌어낸다. 같은 비유를 반복하지 않는다
- 담담하고 직접적. 과잉 위로 없이
- 설교하거나 가르치지 않는다. 가리킬 뿐이다
- 반드시 존댓말(경어)만 사용한다. 반말 절대 금지

【답변 구조 — 반드시 이 순서로, 각 단계 앞에 제목 표시】

**1단계 — 철학적 통찰**
검색된 자료에서 이 사람 상황에 맞는 내용을 찾아 웃네 씨의 언어로 새로 쓴다.
3~5문장. 문장을 그대로 붙여넣지 않는다.

**2단계 — 명상적 접근**
검색된 수필에서 자연스럽게 끌어낸 비유로 지금 이 마음을 어떻게 바라볼 것인지 가리킨다.
3~4문장. 매번 다른 비유를 사용한다.

**3단계 — 코칭 질문**
아래 질문 중 이 상황에 가장 맞는 것 하나로 마무리한다.
답을 주지 않는다. 질문으로 끝낸다.

코칭 질문 목록:
${COACHING_QUESTIONS.join('\n')}

【절대 금지】
- 자료 문장 그대로 복붙
- 심리 치료 흉내
- "괜찮아요, 잘하고 있어요" 식 공허한 위로
- 반말 사용
- "호흡에 집중하세요", "숨을 고르세요", "깊게 숨을 쉬세요" 같은 일반 명상 앱 표현
- 같은 비유 반복 사용
- 답을 주는 것 (항상 질문으로 마무리)
- 심리 치료가 아님을 잊지 말 것
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
    insight: extractSection(text, ['1단계', '철학적 통찰', '**1단계', '## 1단계']),
    meditation: extractSection(text, ['2단계', '명상적 접근', '**2단계', '## 2단계']),
    question: extractQuestion(text)
  };
}

function extractQuestion(text) {
  const markers = ['3단계', '코칭 질문', '**3단계', '## 3단계'];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const content = text.slice(idx).trim();
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if ((line.endsWith('?')) && line.length > 10) {
        if (!markers.some(m => line.includes(m))) {
          return line.replace(/^[-*•]\s*/, '').trim();
        }
      }
    }
  }
  // 못 찾으면 전체에서 마지막 물음표 문장
  const allLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const questions = allLines.filter(l => l.endsWith('?') && l.length > 10);
  return questions.length > 0 ? questions[questions.length - 1].replace(/^[-*•]\s*/, '') : '';
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
  const stops = ['**2단계', '**3단계', '\n\n---', '2단계 —', '3단계 —', '## 2단계', '## 3단계'];
  let earliest = text.length;
  for (const s of stops) {
    const idx = text.indexOf(s, from);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  return earliest;
}
