const SYSTEM_PROMPT = `You are a gentle children's bedtime story writer. Write an original, soothing bedtime story suitable for young children, plus a short illustration prompt for one gentle scene from it.

Rules for the story:
- Calm, gentle pacing with cozy, warm imagery. No violence, scares, or peril beyond mild, easily-resolved conflict.
- No matter how silly the requested tone is, the story must still end on a peaceful, sleepy, comforting note — it's still a bedtime story.
- Roughly 600-800 words, which reads aloud in about 3-5 minutes.
- Plain prose only: no markdown, no headings, no bullet points, no title line.
- Write a new, original story each time; vary characters and settings.

Rules for the illustration prompt:
- Describe one specific, gentle scene from the story you just wrote: the main character, the setting, and the mood.
- Write it as a visual description for an image generator, not as narrative prose.
- Style: soft, warm children's picture-book illustration, gentle colors, cozy lighting.
- No scary, violent, or unsettling imagery.
- Absolutely no text, letters, words, numbers, or writing of any kind should appear in the described image — describe only visual scenery/characters.
- 1-2 sentences, concise.

Format your reply EXACTLY like this and nothing else: first the full story text, then a line containing only ===ILLUSTRATION===, then the illustration prompt. Do not use JSON, markdown, headings, quotes around the sections, or any other labels.`;

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

const SILLINESS_TIERS = [
  {
    label: 'Calm',
    guidance: 'Keep the tone exactly as gentle and soothing as usual, with no jokes or silliness.',
  },
  {
    label: 'Sweet',
    guidance: 'Add just a touch of warmth and light humor here and there, but keep it mostly calm and sweet, nothing goofy.',
  },
  {
    label: 'Playful',
    guidance: 'Include some lighthearted humor and a funny little moment or two, while keeping the overall story calm.',
  },
  {
    label: 'Goofy',
    guidance: 'Make it noticeably silly: include silly wordplay, a funny mishap, and an exaggerated reaction or two, while still resolving gently.',
  },
  {
    label: 'Wacky',
    guidance: 'Make it broadly, absurdly silly throughout — silly names, ridiculous situations, funny sound effects in the prose — while still winding down to a peaceful, sleepy ending.',
  },
];

const IMAGE_SILLINESS_GUIDANCE = [
  '',
  '',
  ' The illustration can include a small playful or whimsical touch.',
  ' The illustration can be lightly cartoonish and playful.',
  ' The illustration can be broadly cartoonish and exaggerated, matching the wacky tone.',
];

function resolveSilliness(rawValue) {
  const index = Number.isInteger(rawValue) ? rawValue : Number.parseInt(rawValue, 10);
  if (!Number.isInteger(index) || index < 0 || index >= SILLINESS_TIERS.length) {
    return 0;
  }
  return index;
}

async function generateStory(env, request) {
  if (!env.GROQ_API_KEY) {
    return new Response('Server is missing GROQ_API_KEY configuration.', { status: 500 });
  }

  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const seed = Math.floor(Math.random() * 2 ** 31);

  const body = await request.json().catch(() => ({}));
  const silliness = resolveSilliness(body.silliness);
  const storyGuidance = SILLINESS_TIERS[silliness].guidance;
  const imageGuidance = IMAGE_SILLINESS_GUIDANCE[silliness];

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
            content: `Please write tonight's bedtime story. Feature ${character} as the main character, set in ${theme}. Tone: ${storyGuidance}${imageGuidance}`,
          },
        ],
      }),
    });
  } catch (err) {
    return new Response(`Failed to reach Groq: ${err.message}`, { status: 500 });
  }

  if (!groqResponse.ok) {
    const errorBody = (await groqResponse.text()).slice(0, 300);
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

  const DELIMITER = '===ILLUSTRATION===';
  const delimiterIndex = rawContent.indexOf(DELIMITER);
  let story;
  let imagePrompt;
  if (delimiterIndex === -1) {
    // No illustration marker: use the whole reply as the story, skip the image.
    story = rawContent.trim();
    imagePrompt = '';
  } else {
    story = rawContent.slice(0, delimiterIndex).trim();
    imagePrompt = rawContent.slice(delimiterIndex + DELIMITER.length).trim();
  }

  if (!story) {
    return new Response('Groq response did not contain a story.', { status: 502 });
  }

  // The illustration is best-effort: no prompt means no image, story still renders.
  const image = imagePrompt ? await generateImage(env, imagePrompt) : null;

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
      return generateStory(env, request);
    }

    return env.ASSETS.fetch(request);
  },
};
