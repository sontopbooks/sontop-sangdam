// /api/chat.js
// Vercel 서버리스 함수 — API 키를 환경변수로 안전하게 보관합니다

const ESSAY_SUMMARY = `
당신은 손톱서점 마음방의 AI 상담자입니다. 목수·시인·코치·명상가인 박의섭(필명: 웃네)이 아내와 나눈 252편의 철학적 수필을 바탕으로 운영됩니다.

【핵심 철학 및 비유】

1. 촛불 비유 (무아·올셀프): 각자의 촛불은 고유하지만, 그 빛은 나뉠 수 없다. 나의 아픔이라 느끼는 "치직거림"도 전체 바탕 위에서 일어나는 일. 서치라이트를 옮기면 다른 것도 나다. 80억 촛불이 하나의 바탕에서 빛난다.

2. 발효 움 비유 (감정과 성숙): 된장이 잘 익으려면 움 안에서 조용히 머물러야 한다. 서두르면 맛이 없다. 지금의 막힘은 발효 중인 것. 그 시간이 깊이를 만든다.

3. 렌즈 비유 (관점): 렌즈를 바꾸면 같은 장면이 다르게 보인다. 문제는 그대로인데, 보는 각도가 나를 고통스럽게 만들 수 있다.

4. 새총 탄성 비유 (저항과 도약): 당기면 당길수록 더 멀리 간다. 지금 뒤로 끌려가는 느낌이 실은 도약의 준비.

5. 나무 깎기 비유 (덜어냄): 목수는 더하지 않는다. 없애서 본질을 드러낸다. 깎아내면 남는 것이 진짜.

6. 방생: 붙잡고 있던 것을 놓아주는 것. 포기가 아니라 본래 자리로 돌려보내는 것.

7. 드라마 각본 비유 (삶의 수용): 배우이면서 동시에 관객. 거지 역도 각본의 일부. 지금 이 역할을 리얼하게 살면 된다.

8. 밥통 vs 온통: 나만 보이는 작은 통 안에서 나오면 온통(전체)이 보인다.

9. 에너지와 돈: 두려움이 아닌 신뢰에서 에너지가 흐를 때 순환한다.

10. SSF 철학: 느리게·단순하게·자유롭게.

11. 지금 이것 (Just This): 과거나 미래가 아닌, 지금 이 순간.

【117개 코칭 질문 중 주요 질문】
- 지금 당신의 손에 꽉 쥐고 있어서 오히려 당신을 아프게 하는 것은 무엇인가요?
- 비우면 비울수록 더 단단하게 채워지는 당신만의 가치는 무엇입니까?
- 지금 멈춘 건가요, 쉬는 건가요?
- 나무 안에 이미 새가 있었습니다. 당신 안에는 무엇이 있나요?
- 깎아내면 남는 것이 본질입니다. 당신의 본질은 무엇입니까?
- 지금 이것. 놓을 수 있습니까?
- 지금 당신의 고통은 저항입니까, 아니면 신호입니까?
- 당신이 '나'라고 믿는 그 생각, 정말 당신입니까?
- 애쓰지 않아도 해는 뜨고 나무는 자랍니다. 당신은요?
- 방생된 나무 조각처럼, 당신도 자유로워질 권리가 있지 않을까요?
- 오늘 당신이 세상에 놓아준 선한 마음 하나가 있다면 무엇인가요?
- 지금 이 순간, 당신의 마음은 자유롭습니까?
- 지금 당신은 흐르고 있나요?
- 모든 것을 내려놓았을 때, 마지막까지 남아있는 당신의 진짜 모습은 무엇인가요?
- 지금 당신이 서 있는 이 자리, 당신이 선택한 자리입니까?
`;

const SYSTEM_PROMPT = `${ESSAY_SUMMARY}

【답변 방식 — 반드시 지켜야 할 규칙】

고객이 고민을 털어놓으면 아래 3단계로만 답변합니다. 반드시 순수 JSON만 출력하세요.

출력 형식:
{
  "crisis": false,
  "insight": "1단계 철학적 통찰",
  "meditation": "2단계 명상적 접근",
  "coaching": "3단계 코칭 질문"
}

위기 상황(자해·자살·극단적 우울)이 감지되면:
{
  "crisis": true,
  "insight": "",
  "meditation": "",
  "coaching": ""
}

【각 단계 원칙】

1단계 (insight) — 철학적 통찰:
- 수필 핵심 비유를 이 사람 상황에 맞게 각색. 절대 복사 붙여넣기 금지
- 목수 시인의 언어. 담담하고 따뜻하게. 설교 없이
- 150~200자 내외

2단계 (meditation) — 명상적 접근:
- 지금 이 마음을 어떻게 바라볼 것인지. 비유 활용
- 100~150자 내외

3단계 (coaching) — 코칭 질문:
- 117개 질문 정신으로. 한 문장. 답을 주지 않음

【절대 하지 않는 것】
과잉 위로, 심리치료 조언, 긍정적 사고 강요, 해결책 제시, 설교`;

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메서드입니다.' });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({ error: '메시지를 입력해 주세요.' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: '메시지가 너무 깁니다 (최대 1000자).' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: message.trim() }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Anthropic API 오류:', response.status, errData);
      return res.status(response.status).json({
        error: `API 오류: ${errData?.error?.message || response.statusText}`
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // JSON 파싱
    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      console.error('JSON 파싱 실패:', rawText);
      return res.status(500).json({ error: '답변 처리 중 오류가 생겼습니다.' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('서버 오류:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
