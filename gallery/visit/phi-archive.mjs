// Uses the same archived art-card metadata as the public gallery viewer.
// Gallery archives are the authority for daily counts, identities and orientations.
export async function loadPhiArchive(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid exhibition date');
 const url=new URL('../'+date+'/index.html',import.meta.url);
 const response=await fetch(url,{cache:'no-cache'});
 if(!response.ok)throw Error('Archive unavailable for '+date+' (HTTP '+response.status+')');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 const studies=[...doc.querySelectorAll('article.art-card')].map((card,i)=>{
  const img=card.querySelector('.art-image-link img'),link=card.querySelector('a.remix');
  if(!img||!link)throw Error('Archive artwork '+(i+1)+' is missing its image or remix link');
  const src=new URL(img.getAttribute('src'),url);
  const image=src.hostname==='github.com'&&src.pathname.includes('/releases/download/')?
   new URL('../release-art/'+src.pathname.split('/').pop(),import.meta.url).href:src.href;
  const href=new URL(link.getAttribute('href'),url).href;
  const width=Number(img.getAttribute('width')),height=Number(img.getAttribute('height'));
  return {id:card.id||date+'-'+(i+1),title:card.querySelector('h2')?.textContent.trim()||'Untitled',
   seed:card.querySelector('dd')?.textContent.trim()||new URL(href).searchParams.get('seed')||'',
   portrait:card.dataset.orientation==='portrait'||height>width,
   aspect:width&&height?width/height:1.4,image,href,engine:new URL(href).searchParams.get('mode')||'field',
   material:card.dataset.material||'marker'};
 });
 if(!studies.length)throw Error('No archived artworks for '+date);
 if(new Set(studies.map(s=>s.id)).size!==studies.length)throw Error('Duplicate archive identifiers');
 return studies;
}
