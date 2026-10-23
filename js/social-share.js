// Export sharing: reversible, browser-only compact link for user-created art.
// No external shortener and no changes to any historical full artwork URLs.
(function(A){
  'use strict';
  function orderedKeys(settingKeys){
    return ['v'].concat(settingKeys,['sheet','material','fit','tissue','watercolor']);
  }
  function encode(values){
    var bytes=new TextEncoder().encode(values.join('\x1f'));
    var chars='';
    for(var i=0;i<bytes.length;i++)chars+=String.fromCharCode(bytes[i]);
    return btoa(chars).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function decode(token){
    if(typeof token!=='string'||!token||token.length>1500||!/^[A-Za-z0-9_-]+$/.test(token))
      return null;
    var chars=atob(token.replace(/-/g,'+').replace(/_/g,'/')+
      '='.repeat((4-token.length%4)%4));
    var bytes=Uint8Array.from(chars,function(c){return c.charCodeAt(0)});
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\x1f');
  }
  function compact(fullURL,settingKeys){
    var original=new URL(fullURL),keys=orderedKeys(settingKeys),params=original.searchParams;
    var allowed=new Set(keys),unknown=false;
    params.forEach(function(v,k){if(!allowed.has(k))unknown=true});
    if(unknown||!params.has('v'))return original.href;
    var values=keys.map(function(k){return params.has(k)?params.get(k):''});
    // Separator cannot appear literally in values; never create a lossy link.
    if(values.some(function(v){return v.includes('\x1f')}))return original.href;
    var link=new URL(original.href);
    link.search='?c='+encode(values);
    return link.href;
  }
  function expand(token,settingKeys){
    try{
      var keys=orderedKeys(settingKeys),values=decode(token);
      if(!values||values.length!==keys.length||!values[0]||!/^\d+$/.test(values[0]))
        return null;
      var params=new URLSearchParams();
      keys.forEach(function(key,i){
        if(values[i]!=='')params.set(key,values[i]);
      });
      // Round-trip strictly: bad/incomplete tokens must not show wrong art.
      if(encode(values)!==token)return null;
      return params;
    }catch(error){return null}
  }
  function intents(fullURL,settingKeys){
    var shortURL=compact(fullURL,settingKeys),
        // GitHub Pages has one static OG image for every query string.
        // Our already-hosted Render service responds with unique SSR tags
        // and a real PROPORTION PIECE canvas preview for each compact artwork.
        token=new URL(shortURL).searchParams.get('c'),
        previewURL=token?'https://proportion-piece-social.mr-adam-clement.workers.dev/share?c='+
          encodeURIComponent(token):shortURL,
        caption='PROPORTION PIECE '+previewURL,
        // Meta/Threads may cache the old (unversioned) generic preview
        // for this artwork. Only Threads gets a new page-cache identity;
        // Bluesky retains its already-working URL.
        threadsPreviewURL=token?previewURL+'&pv=2':previewURL,
        threadsCaption='PROPORTION PIECE '+threadsPreviewURL;
    return{
      fullURL:fullURL,
      artworkURL:shortURL,
      previewURL:previewURL,
      caption:caption,
      threadsPreviewURL:threadsPreviewURL,
      threadsCaption:threadsCaption,
      threads:'https://www.threads.com/intent/post?text='+encodeURIComponent(threadsCaption),
      bluesky:'https://bsky.app/intent/compose?text='+encodeURIComponent(caption)
    };
  }
  A.socialShare={compact:compact,expand:expand,intents:intents};
})(window.AlgoArt);
