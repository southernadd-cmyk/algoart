import fs from 'node:fs/promises';
import path from 'node:path';

export const LAB_URL='https://southernadd-cmyk.github.io/algoart/gallery/sculpture-lab/';
// Serve the checkout at the real site origin. The R2 workers deliberately
// allow that origin; localhost would test a CORS policy the public lab never uses.
export async function routeLabCheckout(page){
  const root=process.cwd();
  await page.route('https://southernadd-cmyk.github.io/algoart/**',async route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/algoart/'.length));
    const target=path.resolve(root,relative.endsWith('/')?relative+'index.html':relative);
    if(!target.startsWith(root+path.sep))return route.abort();
    if(!(await fs.stat(target).catch(()=>null))?.isFile())
      return route.fulfill({status:404,body:'Missing checkout file: '+relative});
    return route.fulfill({path:target});
  });
}
