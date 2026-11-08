import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {access,copyFile,cp,mkdir,mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

export async function rehearseOilV8Edition(day,editorUrl){
  // An isolated directory lets the real archive builder write its usual output
  // without changing tracked files or reaching any publishing credentials.
  const work=await mkdtemp(path.resolve('.oil-v8-rehearsal-'));
  const gallery=path.join(work,'gallery');
  const edition=path.join(gallery,day);
  const baseEnv={...process.env,SOCIAL_DATE:day,ALGOART_LOCAL_URL:editorUrl,GITHUB_OUTPUT:''};
  function run(command,args,cwd=work,env={}){
    const result=spawnSync(command,args,{cwd,env:{...baseEnv,...env},encoding:'utf8',timeout:240000,maxBuffer:8e6});
    assert.equal(result.status,0,[command,...args].join(' ')+': '+(result.error?.message||'')+' '+result.stderr+' '+result.stdout);
    return result.stdout;
  }
  const node=(file,args=[],env={},cwd=work)=>run(process.execPath,[path.resolve(file),...args],cwd,env);
  const json=async file=>JSON.parse(await readFile(file,'utf8'));
  try{
    await mkdir(gallery);
    await mkdir(path.join(work,'automation'));
    await symlink(path.resolve('gallery/visit'),path.join(gallery,'visit'),'dir');
    await symlink(path.resolve('js'),path.join(work,'js'),'dir');
    for(const script of ['build-gallery-previews.py','build-gallery-3d-textures.py'])
      await copyFile(path.resolve('automation',script),path.join(work,'automation',script));
    if(spawnSync('python3',['-c','from PIL import Image']).status!==0){
      baseEnv.PYTHONPATH=path.join(work,'python');
      run('python3',['-m','pip','install','--quiet','--target',baseEnv.PYTHONPATH,'Pillow>=10,<13']);
    }
    const oilOutput=path.join('social-output',day,'oil');
    await cp(path.resolve(oilOutput),path.join(work,oilOutput),{recursive:true});
    for(const [material,count] of [['marker',2],['watercolor',2],['watercolour',2],['oil',2],['action',1]]){
      for(const orientation of ['landscape','portrait']){
        if(material!=='oil')
          node('automation/generate-social.mjs',[],{SOCIAL_MATERIAL:material,SOCIAL_ORIENTATION:orientation,SOCIAL_COUNT:String(count)});
        node('automation/build-gallery.mjs',[],{GALLERY_QUEUE_MATERIAL:material,GALLERY_QUEUE_ORIENTATION:orientation});
      }
    }
    const meta=await json(path.join(edition,'meta.json'));
    assert.equal(meta.count,18);
    assert.equal(new Set(meta.entries.map(item=>item.id)).size,18);
    const oil=meta.entries.filter(item=>item.material==='oil');
    assert.equal(oil.length,4);
    assert(oil.every(item=>item.rendererVersion===9&&new URL(item.shareUrl).searchParams.get('material')==='oil-v8'));

    run('python3',['automation/build-gallery-previews.py','--date',day,'--force']);
    run('python3',['automation/build-gallery-3d-textures.py','--date',day]);
    const bakeUrl=new URL(path.basename(work)+'/',editorUrl).href;
    node('automation/build-gallery-sculptures.mjs',['--date',day],{GALLERY_BAKE_URL:bakeUrl});
    await access(path.join(edition,'archive-preview.jpg'));
    const textures=await json(path.join(edition,'3d','manifest.json'));
    const sculptures=JSON.parse(gunzipSync(await readFile(path.join(edition,'3d','sculptures.json.gz'))));

    const social=path.join(work,'social-dry-run');
    await mkdir(social);
    const selections=[];
    for(const orientation of ['landscape','portrait']){
      const studies=oil.filter(item=>item.orientation===orientation);
      assert.equal(studies.length,2);
      for(const study of studies){
        for(const quality of ['desktop','mobile']){
          await access(path.join(edition,textures.images[study.imageFile][quality]));
          if(orientation==='portrait')assert(sculptures.studies[study.imageFile][quality].length>0);
        }
      }
      const env={SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:orientation,SOCIAL_COUNT:'1',SLOT:'1'};
      node('automation/generate-social.mjs',[],env,social);
      const selected=Object.fromEntries(node('automation/oil-slot.mjs',['select'],env,social).trim().split('\n').map(line=>{
        const separator=line.indexOf('=');
        return [line.slice(0,separator),line.slice(separator+1)];
      }));
      const archived=studies.find(item=>item.id===selected.id);
      assert(archived,'Scheduled Oil artwork must be in the same dated gallery');
      assert.equal(selected.share_url,archived.shareUrl);
      assert((await readFile(selected.image_path)).equals(await readFile(path.join(edition,archived.imageFile))));
      assert.match(Buffer.from(selected.instagram_caption_b64,'base64').toString(),/\/ OIL\n/);
      for(const platform of ['instagram','threads','bluesky']){
        const caption=Buffer.from(selected[platform+'_caption_b64'],'base64').toString();
        assert.doesNotMatch(caption,/OIL PAINT V\d+|OIL V\d+/i,'Public '+platform+' copy must hide engine revisions');
      }
      assert.match(Buffer.from(selected.pinterest_title_b64,'base64').toString(),/\bOil\b/);
      assert.match(Buffer.from(selected.pinterest_description_b64,'base64').toString(),/^Oil study\./);
      if(orientation==='portrait')assert.match(selected.instagram_asset_name,/-instagram\.jpg$/);
      selections.push({orientation,id:archived.id,seed:archived.seed});
    }
    console.log('PASS 18-study V8 gallery, thumbnail, tower assets and both 15:00 Oil media selections for '+day);
    return {date:day,count:meta.count,oil:oil.map(item=>item.id),selections};
  }finally{
    await rm(work,{recursive:true,force:true});
  }
}
