const SYSTEM_PROMPT = `You are a gentle children's bedtime story writer. Write an original, soothing bedtime story suitable for young children.

Rules:
- Calm, gentle pacing with cozy, warm imagery. No violence, scares, or peril beyond mild, easily-resolved conflict.
- End on a peaceful, sleepy, comforting note.
- Roughly 600-800 words, which reads aloud in about 3-5 minutes.
- Plain prose only: no markdown, no headings, no bullet points, no title line.
- Write a new, original story each time; vary characters and settings.`;

async function generateStory(env) {
  if (!env.GROQ_API_KEY) {
    return new Response('Server is missing GROQ_API_KEY configuration.', { status: 500 });
  }

  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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
        temperature: 0.9,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: 'Please write tonight\'s bedtime story.' },
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
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
