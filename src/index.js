const SYSTEM_PROMPT = `You are a gentle children's bedtime story writer. Write an original, soothing bedtime story suitable for young children, plus a short illustration prompt for one gentle scene from it.

Rules for the story:
- Calm, gentle pacing with cozy, warm imagery. No violence, scares, or peril beyond mild, easily-resolved conflict.
- No matter how silly the requested tone is, the story must still end on a peaceful, sleepy, comforting note — it's still a bedtime story.
- Roughly 600-800 words, which reads aloud in about 3-5 minutes.
- Plain prose only: no markdown, no headings, no bullet points within the story body.
- Write a new, original story each time; vary characters and settings.

Rules for the illustration prompt:
- Describe one specific, gentle scene from the story you just wrote: the main character, the setting, and the mood.
- Write it as a visual description for an image generator, not as narrative prose.
- Style: soft, warm children's picture-book illustration, gentle colors, cozy lighting.
- No scary, violent, or unsettling imagery.
- Absolutely no text, letters, words, numbers, or writing of any kind should appear in the described image — describe only visual scenery/characters.
- 1-2 sentences, concise.

Output format — you MUST follow this exactly. Begin your response with the title on the very first line. Do not add any preamble, greeting, or explanation before or after.

The Starlight Meadow
===STORY===
Once upon a time…[story continues]…and soon drifted off to sleep.
===ILLUSTRATION===
A soft watercolor scene of a small rabbit curled beneath a glowing lantern in a moonlit meadow, warm golden light, peaceful and dreamy.

Replace the example above with your own original title, story, and illustration prompt. The ===STORY=== and ===ILLUSTRATION=== markers must appear exactly as shown, each on its own line, with no extra characters.`;

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

const CF_TEXT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

async function generateStory(env, request) {
  const body = await request.json().catch(() => ({}));
  const silliness = resolveSilliness(body.silliness);
  const storyGuidance = SILLINESS_TIERS[silliness].guidance;
  const imageGuidance = IMAGE_SILLINESS_GUIDANCE[silliness];

  const character = (body.character && CHARACTERS.includes(body.character))
    ? body.character
    : CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const theme = (body.theme && THEMES.includes(body.theme))
    ? body.theme
    : THEMES[Math.floor(Math.random() * THEMES.length)];

  const LENGTH_OVERRIDES = [
    'Keep it short: roughly 350-450 words (about 2 minutes read-aloud).',
    null,
    'Make it longer: roughly 900-1100 words (about 5-6 minutes read-aloud).',
  ];
  const lengthIndex = [0, 1, 2].includes(Number(body.length)) ? Number(body.length) : 1;
  const moral = (body.moral && body.moral !== 'none') ? body.moral : null;

  let userMessage = `Please write tonight's bedtime story. Feature ${character} as the main character, set in ${theme}. Tone: ${storyGuidance}${imageGuidance}`;
  if (LENGTH_OVERRIDES[lengthIndex]) userMessage += ` ${LENGTH_OVERRIDES[lengthIndex]}`;
  if (moral) userMessage += ` Weave in a gentle moral about ${moral}.`;

  let aiResult;
  try {
    aiResult = await env.AI.run(CF_TEXT_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 3072,
    });
  } catch (err) {
    return new Response(`Workers AI error: ${err.message}`, { status: 500 });
  }

  const rawContent = aiResult?.response;
  if (!rawContent) {
    return new Response('Workers AI did not return a response.', { status: 502 });
  }

  // Split title from story body on ===STORY===
  const storyMatch = rawContent.match(/=+\s*STORY\s*=+/i);
  let title;
  let storyAndImage;
  if (!storyMatch) {
    title = '';
    storyAndImage = rawContent;
  } else {
    title = rawContent.slice(0, storyMatch.index).trim();
    storyAndImage = rawContent.slice(storyMatch.index + storyMatch[0].length);
  }

  // Strip markdown formatting from title (model may wrap in **, #, quotes, etc.)
  if (title) {
    // If the model added preamble lines, the title is likely the last short line
    const titleLines = title.split('\n').map(l => l.trim()).filter(Boolean);
    const shortLines = titleLines.filter(l => l.length <= 120 && !l.endsWith(':'));
    title = (shortLines.length > 0 ? shortLines[shortLines.length - 1] : titleLines[titleLines.length - 1] || '');
    title = title
      .replace(/^#+\s*/, '')              // # heading markers
      .replace(/^\*\*(.*)\*\*$/, '$1')    // **bold**
      .replace(/^\*(.*)\*$/, '$1')        // *italic*
      .replace(/^["'"'](.*?)["'"']$/, '$1') // "quoted"
      .replace(/^Title:\s*/i, '')         // "Title:" prefix
      .trim();
  }

  // Tolerant match: the model sometimes splits "===ILLUSTRATION===" across a
  // line break or varies the number of '=' signs. Anchor on the word itself
  // with surrounding '=' and whitespace so any of those variants still splits.
  const delimiterMatch = storyAndImage.match(/=+\s*ILLUSTRATION\s*=*/i);
  let story;
  let imagePrompt;
  if (!delimiterMatch) {
    // No illustration marker: use the whole reply as the story, skip the image.
    story = storyAndImage.trim();
    imagePrompt = '';
  } else {
    story = storyAndImage.slice(0, delimiterMatch.index).trim();
    imagePrompt = storyAndImage.slice(delimiterMatch.index + delimiterMatch[0].length).trim();
  }

  // Fallback: if title is still empty, pull the first line from the story
  if (!title && story) {
    const lines = story.split('\n');
    const firstLine = lines.find(l => l.trim());
    if (firstLine) {
      title = firstLine.trim().replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').slice(0, 120);
      // Remove that line from the story so it doesn't appear twice
      const idx = lines.indexOf(firstLine);
      story = lines.slice(idx + 1).join('\n').trim();
    }
  }

  if (!story) {
    return new Response('Workers AI response did not contain a story.', { status: 502 });
  }

  // The illustration is best-effort: no prompt means no image, story still renders.
  let image = null;
  let imageError = null;
  if (imagePrompt) {
    const result = await generateImage(env, imagePrompt);
    image = result.dataUrl;
    imageError = result.error;
  }

  return new Response(JSON.stringify({ title, story, image, imageError }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function generateImage(env, prompt) {
  try {
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
    if (!result?.image) return { dataUrl: null, error: `No image in AI response (keys: ${Object.keys(result ?? {}).join(', ') || 'none'})` };
    return { dataUrl: `data:image/jpeg;base64,${result.image}`, error: null };
  } catch (err) {
    console.error('Workers AI image generation failed:', err);
    return { dataUrl: null, error: err.message };
  }
}

const ILLUST_PROMPT = `You are an illustration prompt writer for children's picture books. Given a bedtime story, write a single concise illustration prompt (1-2 sentences) describing one gentle, cozy scene from it. Style: soft, warm children's picture-book illustration, gentle colors, cozy lighting. No scary or violent imagery. Absolutely no text, letters, words, or numbers in the image — describe only visual scenery and characters.`;

async function generateIllustration(env, request) {
  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON.', { status: 400 }); }

  const { story } = body;
  if (!story || typeof story !== 'string' || !story.trim())
    return new Response('story is required.', { status: 400 });

  let aiResult;
  try {
    aiResult = await env.AI.run(CF_TEXT_MODEL, {
      messages: [
        { role: 'system', content: ILLUST_PROMPT },
        { role: 'user', content: story.slice(0, 4000) },
      ],
      max_tokens: 256,
    });
  } catch (err) {
    return new Response(`Workers AI error: ${err.message}`, { status: 500 });
  }

  const imagePrompt = aiResult?.response?.trim();
  if (!imagePrompt) return new Response('No illustration prompt from Workers AI.', { status: 502 });

  const { dataUrl, error } = await generateImage(env, imagePrompt);
  return new Response(JSON.stringify({ image: dataUrl, imageError: error }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const VALID_MORALS = ['kindness', 'courage', 'friendship', 'patience', 'sharing', 'honesty', 'perseverance', 'gratitude'];

async function saveStory(env, request) {
  if (!env.DB) return new Response('Database not configured.', { status: 500 });

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON.', { status: 400 }); }

  const { title, story, silliness, character, theme, moral, length } = body;

  if (!title || typeof title !== 'string' || !title.trim())
    return new Response('title is required.', { status: 400 });
  if (!story || typeof story !== 'string' || !story.trim())
    return new Response('story is required.', { status: 400 });
  if (title.length > 200) return new Response('title too long.', { status: 400 });
  if (story.length > 12000) return new Response('story too long.', { status: 400 });

  const sillinessVal = parseInt(silliness, 10);
  if (!Number.isInteger(sillinessVal) || sillinessVal < 0 || sillinessVal > 4)
    return new Response('invalid silliness.', { status: 400 });

  const lengthVal = parseInt(length, 10);
  if (![0, 1, 2].includes(lengthVal))
    return new Response('invalid length.', { status: 400 });

  const charVal  = (character && CHARACTERS.includes(character)) ? character : null;
  const themeVal = (theme && THEMES.includes(theme)) ? theme : null;
  const moralVal = (moral && VALID_MORALS.includes(moral)) ? moral : null;

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      'INSERT INTO stories (id, title, story, silliness, character, theme, moral, length, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, title.trim(), story.trim(), sillinessVal, charVal, themeVal, moralVal, lengthVal, Date.now()).run();
  } catch (err) {
    return new Response(`Database error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function listStories(env, url) {
  if (!env.DB) return new Response('Database not configured.', { status: 500 });

  const params = url.searchParams;
  const offset = Math.max(0, parseInt(params.get('offset') || '0', 10));
  const limit  = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20', 10)));

  const conditions = [];
  const bindings   = [];

  const character = params.get('character');
  if (character && CHARACTERS.includes(character)) { conditions.push('character = ?'); bindings.push(character); }

  const theme = params.get('theme');
  if (theme && THEMES.includes(theme)) { conditions.push('theme = ?'); bindings.push(theme); }

  const moral = params.get('moral');
  if (moral && VALID_MORALS.includes(moral)) { conditions.push('moral = ?'); bindings.push(moral); }

  const silliness = params.get('silliness');
  if (silliness !== null && silliness !== '') {
    const s = parseInt(silliness, 10);
    if (Number.isInteger(s) && s >= 0 && s <= 4) { conditions.push('silliness = ?'); bindings.push(s); }
  }

  const lengthParam = params.get('length');
  if (lengthParam !== null && lengthParam !== '') {
    const l = parseInt(lengthParam, 10);
    if ([0, 1, 2].includes(l)) { conditions.push('length = ?'); bindings.push(l); }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM stories ${where}`)
      .bind(...bindings).first();
    const total = countRow?.total ?? 0;

    const rows = await env.DB.prepare(
      `SELECT id, title, story, silliness, character, theme, moral, length, created_at FROM stories ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all();

    return new Response(JSON.stringify({ stories: rows.results, total }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(`Database error: ${err.message}`, { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the timer app on any `timer.*` host (e.g. timer.aistuffforparents.com).
    // Every other hostname falls through to the story app below, so adding new
    // domains for the main app never needs a code change here.
    if (url.hostname.startsWith('timer.')) {
      const assetPath = (url.pathname === '/' || url.pathname === '/index.html')
        ? '/timer.html'
        : url.pathname;
      url.pathname = assetPath;
      return env.ASSETS.fetch(new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
      }));
    }

    if (url.pathname === '/api/generate-story' && request.method === 'POST') {
      return generateStory(env, request);
    }
    if (url.pathname === '/api/save-story' && request.method === 'POST') {
      return saveStory(env, request);
    }
    if (url.pathname === '/api/stories' && request.method === 'GET') {
      return listStories(env, url);
    }
    if (url.pathname === '/api/generate-illustration' && request.method === 'POST') {
      return generateIllustration(env, request);
    }

    return env.ASSETS.fetch(request);
  },
};
