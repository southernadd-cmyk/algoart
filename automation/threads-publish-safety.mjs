// Safe Threads publication / recovery. Never create a new container merely
// because a previous threads_publish response was ambiguous.
export const MEDIA_NOT_FOUND_CODE=24;
export const MEDIA_NOT_FOUND_SUBCODE=4279009;

export function isPropagationFailure(error){
  try{
    const payload=JSON.parse(error?.message||'');
    return payload?.error?.code===MEDIA_NOT_FOUND_CODE &&
      payload?.error?.error_subcode===MEDIA_NOT_FOUND_SUBCODE;
  }catch{return false;}
}
export async function findPublishedThread({api,userId,text}){
  let after=null;
  const seen=new Set();
  // Search the account timeline (not a single page): if we cannot establish
  // whether this exact caption was posted, fail closed rather than duplicate it.
  for(let page=0;page<12;page++){
    const result=await api(`${userId}/threads`,{
      fields:'id,text,timestamp',limit:'50',...(after?{after}:{})
    },'GET');
    if(!Array.isArray(result.data))throw Error('Threads timeline response lacks data');
    const matched=result.data.find(post=>post.text===text && post.id);
    if(matched)return matched;
    after=result.paging?.cursors?.after;
    if(!after || result.data.length===0)return null;
    if(seen.has(after))throw Error('Threads timeline cursor loop; cannot safely deduplicate');
    seen.add(after);
  }
  throw Error('Threads timeline pagination limit; cannot safely deduplicate');
}

export async function publishExistingContainerSafely({api,userId,containerId,text,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=5}){
  for(let attempt=0;attempt<attempts;attempt++){
    // Account history is authoritative when a prior call succeeded but the
    // returned response was lost. Recheck before EVERY publish attempt.
    const existing=await findPublishedThread({api,userId,text});
    if(existing)return {id:existing.id,reconciled:true};
    try{
      const response=await api(`${userId}/threads_publish`,{creation_id:containerId});
      if(!response?.id)throw Error('Threads publish response has no media id');
      return response;
    }catch(error){
      // A missing response is ambiguous. Never retry an unknown failure.
      const found=await findPublishedThread({api,userId,text});
      if(found)return {id:found.id,reconciled:true};
      const status=await api(containerId,{fields:'id,status,error_message'},'GET');
      if(status.status==='PUBLISHED')return {id:status.id||containerId,reconciled:true};
      if(status.status==='ERROR'||status.status==='EXPIRED')
        throw Error('Threads container cannot publish: '+JSON.stringify(status));
      if(!isPropagationFailure(error)||status.status!=='FINISHED'||attempt===attempts-1)
        throw error;
      // The publishing endpoint can lag the media status endpoint. Keep the
      // SAME container, wait, and check the timeline again before retrying.
      await sleep(15000);
    }
  }
  throw Error('Threads container publication could not be confirmed');
}
