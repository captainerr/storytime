const SYSTEM_PROMPT = `You are a gentle children's bedtime story writer. Write an original, soothing bedtime story suitable for young children.

Rules:
- Calm, gentle pacing with cozy, warm imagery. No violence, scares, or peril beyond mild, easily-resolved conflict.
- End on a peaceful, sleepy, comforting note.
- Roughly 600-800 words, which reads aloud in about 3-5 minutes.
- Plain prose only: no markdown, no headings, no bullet points, no title line.
- Write a new, original story each time; vary characters and settings.`;

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

  const story = data?.choices?.[0]?.message?.content;
  if (!story) {
    return new Response('Groq response did not contain a story.', { status: 502 });
  }

  return new Response(story.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
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
