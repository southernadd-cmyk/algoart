import test from 'node:test';
import assert from 'node:assert/strict';
import {findPublishedThread,publishExistingContainerSafely,isPropagationFailure} from '../automation/threads-publish-safety.mjs';

const mediaNotFound=new Error(JSON.stringify({error:{code:24,error_subcode:4279009,message:'Media Not Found'}}));
const text='Unique painting with exact seed and share link';
function feed(data=[],after){return {data,paging:{cursors:{...(after?{after}:{})}}};}

test('identifies only Meta code 24 / 4279009 as a propagation failure',()=>{
  assert.equal(isPropagationFailure(mediaNotFound),true);
  for(const e of [new Error('fetch failed'),new Error(JSON.stringify({error:{code:24,error_subcode:7}})),new Error('{}')])
    assert.equal(isPropagationFailure(e),false);
});
test('reads beyond the first page of Threads history before declaring a post absent',async()=>{
  const seen=[];
  const api=async(path,params,method)=>{
    assert.equal(method,'GET');
    seen.push(params.after||'first');
    return params.after?feed([{id:'already-published',text}]):feed([{id:'other',text:'other'}],'next');
  };
  assert.equal((await findPublishedThread({api,userId:'me',text})).id,'already-published');
  assert.deepEqual(seen,['first','next']);
});
test('reconciles a lost publish response and never makes another POST',async()=>{
  let posts=0,reads=0;
  const api=async(path,params,method)=>{
    if(path==='me/threads'&&method==='GET'){
      reads++;
      return reads>=2?feed([{id:'published-id',text}]):feed([]);
    }
    if(path==='me/threads_publish'){posts++;throw mediaNotFound;}
    throw Error('Unexpected API call '+path);
  };
  const out=await publishExistingContainerSafely({api,userId:'me',containerId:'same',text,sleep:async()=>{}});
  assert.deepEqual(out,{id:'published-id',reconciled:true});
  assert.equal(posts,1);
});
test('retry code 24 only after status FINISHED and re-use the SAME creation id',async()=>{
  let posts=0,waits=0;
  const api=async(path,params,method)=>{
    if(path==='me/threads')return feed([]);
    if(path==='same'&&method==='GET')return {id:'same',status:'FINISHED'};
    if(path==='me/threads_publish'){
      assert.equal(params.creation_id,'same');
      if(++posts===1)throw mediaNotFound;
      return {id:'published'};
    }
    throw Error('Unexpected API call '+path);
  };
  const out=await publishExistingContainerSafely({api,userId:'me',containerId:'same',text,sleep:async()=>{waits++}});
  assert.equal(out.id,'published');
  assert.equal(posts,2);
  assert.equal(waits,1);
});
test('status PUBLISHED is a definitive success and prevents another post',async()=>{
  let posts=0;
  const api=async(path,params,method)=>{
    if(path==='me/threads')return feed([]);
    if(path==='same'&&method==='GET')return {id:'same',status:'PUBLISHED'};
    if(path==='me/threads_publish'){posts++;throw mediaNotFound;}
    throw Error('Unexpected API call');
  };
  const out=await publishExistingContainerSafely({api,userId:'me',containerId:'same',text,sleep:async()=>{}});
  assert.equal(out.reconciled,true);
  assert.equal(posts,1);
});
test('unknown errors do not trigger another publish attempt',async()=>{
  let posts=0;
  const api=async(path,params,method)=>{
    if(path==='me/threads')return feed([]);
    if(path==='same'&&method==='GET')return {id:'same',status:'FINISHED'};
    if(path==='me/threads_publish'){posts++;throw Error('Uncertain network timeout');}
  };
  await assert.rejects(()=>publishExistingContainerSafely({api,userId:'me',containerId:'same',text,sleep:async()=>{}}),/Uncertain network timeout/);
  assert.equal(posts,1);
});
test('account timeline API failure fails closed without posting',async()=>{
  let posts=0;
  const api=async(path)=>{if(path==='me/threads')throw Error('timeline unavailable');posts++;return {id:'wrong'}};
  await assert.rejects(()=>publishExistingContainerSafely({api,userId:'me',containerId:'same',text}),/timeline unavailable/);
  assert.equal(posts,0);
});
