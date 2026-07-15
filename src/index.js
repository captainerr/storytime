const SYSTEM_PROMPT = `You are a gentle children's bedtime story writer. Write an original, soothing bedtime story suitable for young children, plus a short illustration prompt for one gentle scene from it.

Rules for the story:
- Calm, gentle pacing with cozy, warm imagery. No violence, scares, or peril beyond mild, easily-resolved conflict.
- End on a peaceful, sleepy, comforting note.
- Roughly 600-800 words, which reads aloud in about 3-5 minutes.
- Plain prose only: no markdown, no headings, no bullet points, no title line.
- Write a new, original story each time; vary characters and settings.

Rules for the illustration prompt (image_prompt):
- Describe one specific, gentle scene from the story you just wrote: the main character, the setting, and the mood.
- Write it as a visual description for an image generator, not as narrative prose.
- Style: soft, warm children's picture-book illustration, gentle colors, cozy lighting.
- No scary, violent, or unsettling imagery.
- Absolutely no text, letters, words, numbers, or writing of any kind should appear in the described image — describe only visual scenery/characters.
- 1-2 sentences, concise.

Respond with ONLY a JSON object with exactly two string fields: "story" and "image_prompt". No other text, no markdown code fences, no explanation.`;

const THEMES = [
  'a quiet forest', 'a cozy cottage', 'a starry meadow', 'a gentle river',
  'a snug treehouse', 'a small fishing village', 'a mountain cabin',
  'a lantern-lit garden', 'a sleepy harbor town', 'a field of fireflies',
  'a warm library', 'a soft snowy village', 'an island with tide pools',
  'a windmill by a lake', 'a greenhouse full of night-blooming flowers',
];

const CHARACTERS = [
  'a small fox', 'a curious rabbit', 'a young owl', 'a gentle bear cub',
  'a little mouse', 'a sleepy hedgehog', 'a tiny turtle', 'a baby otter',
  'a shy deer', 'a small dragon', 'a kind badger', 'a wandering duckling',
];

async function generateStory(env) {
  if (!env.GROQ_API_KEY) {
    return new Response('Server is missing GROQ_API_KEY configuration.', { status: 500 });
  }

  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const seed = Math.floor(Math.random() * 2 ** 31);

  let groqResponse;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 1,
        seed,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Please write tonight's bedtime story. Feature ${character} as the main character, set in ${theme}.`,
          },
        ],
      }),
    });
  } catch (err) {
    return new Response(`Failed to reach Groq: ${err.message}`, { status: 500 });
  }

  if (!groqResponse.ok) {
    const errorBody = await groqResponse.text();
    return new Response(`Groq API error (${groqResponse.status}): ${errorBody}`, { status: 502 });
  }

  let data;
  try {
    data = await groqResponse.json();
  } catch (err) {
    return new Response(`Failed to parse Groq response: ${err.message}`, { status: 500 });
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    return new Response('Groq response did not contain a message.', { status: 502 });
  }

  let parsed;
  try {
    const cleaned = rawContent.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return new Response(`Groq response was not valid JSON: ${err.message}`, { status: 502 });
  }

  const story = typeof parsed.story === 'string' ? parsed.story.trim() : '';
  const imagePrompt = typeof parsed.image_prompt === 'string' ? parsed.image_prompt.trim() : '';

  if (!story) {
    return new Response('Groq response did not contain a story.', { status: 502 });
  }
  if (!imagePrompt) {
    return new Response('Groq response did not contain an image_prompt.', { status: 502 });
  }

  const image = await generateImage(env, imagePrompt);

  return new Response(JSON.stringify({ story, image }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function generateImage(env, prompt) {
  try {
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
    if (!result?.image) return null;
    return `data:image/jpeg;base64,${result.image}`;
  } catch (err) {
    console.error('Workers AI image generation failed:', err);
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate-story' && request.method === 'POST') {
      return generateStory(env);
    }

    return env.ASSETS.fetch(request);
  },
};
