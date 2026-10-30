import { SITE_URL } from './config.mjs';

function strategyName(stats, fallback) {
  const parts = String(stats || '').split(' / ');
  return parts.length > 1 ? parts[1].trim() : fallback.toUpperCase();
}

// An editor link, NOT a gallery link: the app resolves the archived exact
// settings, renders the identical image, then expands the address bar to the
// full share URL. This keeps Threads/Bluesky within their caption limits.
export function editorArtworkLink(item) {
  const id=String(item.id||'');
  if (!/^\d{4}-\d{2}-\d{2}-(?:(?:ACL|ACP|WL|WP|CL|CP|OL|OP|P)\d{2}|\d{2})$/.test(id)) {
    throw new Error('Cannot link artwork without a valid daily archive ID: '+id);
  }
  const url=new URL(SITE_URL);
  url.searchParams.set('art',id);
  return url.href;
}

// Platform limits are enforced before queuing or sending a post.
// Never truncate a URL, seed, or source artwork identity to fit a caption.
export const SOCIAL_CAPTION_LIMITS=Object.freeze({bluesky:300,threads:500});
export function socialGraphemes(value){
  return [...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(String(value))].length;
}
function fittedCaption(platform,versions){
  const max=SOCIAL_CAPTION_LIMITS[platform];
  for(const version of versions){
    if(socialGraphemes(version)<=max)return version;
  }
  throw new Error(platform+' artwork link exceeds '+max+' graphemes; cannot publish safely.');
}

// Keep captions varied but stable for a given artwork, including retries.
// Hash only public, reproducible metadata. Never use Math.random() here.
export function captionVariant(item) {
  const key = [item.id, item.material, item.mode, item.seed].join('|');
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 5;
}

export function makeCaptions(item) {
  const strategy = strategyName(item.stats, item.mode);
  const watercolour=item.material==='watercolour';
  const oil=item.material==='oil',action=item.material==='action';
  const heading=`${item.series.toUpperCase()} / ${strategy}${action?(item.shareUrl?.includes('material=action-v4')?' / ACTION PAINTING V4':item.shareUrl?.includes('material=action-v3')?' / ACTION PAINTING V3':item.shareUrl?.includes('material=action-v2')?' / ACTION PAINTING V2':' / ACTION PAINTING V1'):oil?(item.shareUrl?.includes('material=oil-v7')?' / OIL PAINT V7':item.shareUrl?.includes('material=oil-v6')?' / OIL PAINT V6':item.shareUrl?.includes('material=oil-v5')?' / OIL PAINT V5':item.shareUrl?.includes('material=oil-v4')?' / OIL PAINT V4':item.shareUrl?.includes('material=oil-v3')?' / OIL PAINT V3':' / OIL PAINT V1'):watercolour?' / WATERCOLOUR V2S':
    item.material==='watercolor'?' / TISSUE & GRAPHITE':''}`;
  const format = item.settings.orientation === 'portrait' ? 'Portrait study · ' : '';
  const watercolor = item.material === 'watercolor';
  const facts=`${format}Seed ${item.seed} · φ ${item.settings.phiStrength}% · ${action?'action painting · '+item.settings.palette+' palette':oil?'oil painting · '+item.settings.palette+' palette':watercolour?'watercolour':
    watercolor?'tissue & graphite':item.settings.pen+' marker'}`;
  const medium=action?'action painting':oil?'oil paint':watercolour?'watercolour':
    watercolor?'tissue and graphite':'marker';
  const series=String(item.series||'abstract composition').toLowerCase();
  const orientation=item.settings.orientation==='portrait'?'portrait':'landscape';
  const variant=captionVariant(item);
  const opening=[
    `A ${medium} study built around ${series}.`,
    `Today's ${orientation} drawing begins with ${series}.`,
    `Golden-ratio geometry, worked through ${series} in ${medium}.`,
    `Another result from ${series}, this time in ${medium}.`,
    `Exploring how ${series} behaves as ${medium}.`
  ][variant];
  const notes=[
    'The seed can recreate the composition in the editor.',
    'The underlying geometry is precise; the marks are deliberately irregular.',
    'An experiment in structure, colour and imperfect marks.',
    'A drawing whose proportions come from φ.',
    'A different material makes the same rules feel different.'
  ];
  const instagramTags=[
    '#generativeart #creativecoding #digitalart',
    '#algorithmicart #abstractart #generativedesign',
    '#generativeart #goldenratio #digitaldrawing',
    '#creativecoding #algorithmicart #artprocess',
    '#generativedesign #digitalart #abstractart'
  ];
  const blueskyTags=[
    '#generativeart #creativecoding',
    '#algorithmicart #generativedesign',
    '#generativeart #abstractart',
    '#creativecoding #digitalart',
    '#generativeart #goldenratio'
  ];
  // Threads gets zero or one short hashtag; avoid tag-heavy repetitive posts.
  const threadsTags=['', '#generativeart', '', '#creativecoding', ''];
  const link=editorArtworkLink(item);
  const threads=fittedCaption('threads',[
    [opening,'',heading,facts,'',notes[variant],'',link,threadsTags[variant]].filter(Boolean).join('\n'),
    [opening,heading,facts,'',link,threadsTags[variant]].filter(Boolean).join('\n'),
    [heading,facts,'',link,threadsTags[variant]].filter(Boolean).join('\n'),
    [heading,link].join('\n'),
    link
  ]);
  const bluesky=fittedCaption('bluesky',[
    [opening,heading,facts,'',link,blueskyTags[variant]].filter(Boolean).join('\n'),
    [heading,facts,'',link,blueskyTags[variant]].filter(Boolean).join('\n'),
    [heading,facts,'',link].filter(Boolean).join('\n'),
    [heading,link].join('\n'),
    link
  ]);
  return {
    instagram:[
      opening,'',heading,facts,'',notes[variant],
      '',link,'',instagramTags[variant]
    ].join('\n'),
    threads,
    bluesky,
    altText:action?`Action painting from PROPORTION PIECE's ${item.series} system, seed ${item.seed}. Flowing paint skeins, irregular pools and splashes drawn from golden-ratio source geometry.`:oil?
      `Oil painting from PROPORTION PIECE's ${item.series} system, ${format.toLowerCase()}seed ${item.seed}, ${item.settings.palette} colour palette. Source-linked golden-ratio colour masses rendered with physical loaded bristle strokes.`:
      watercolour?
      `Watercolour painting from PROPORTION PIECE's ${item.series} system, ${format.toLowerCase()}seed ${item.seed}. Golden-ratio geometry translated into source-colour matched wet pigment washes and fine dry brush on textured paper.`:
      watercolor
      ? `Tissue and graphite artwork from PROPORTION PIECE's ${item.series} system, ${format.toLowerCase()}seed ${item.seed}. Golden-ratio composition with layered translucent colour, textured paper and darker marks.`
      : `Abstract algorithmic marker artwork from PROPORTION PIECE's ${item.series} system. ` +
        `Generated from seed ${item.seed} using golden-ratio composition rules and imperfect ${item.settings.pen} marker strokes.`
  };
}


