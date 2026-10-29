// Keep every test-tower lift journey on the page that launched it.
// An HTML <base href="../../gallery/visit/"> is required for gallery assets,
// but a relative ?date= in history.replaceState would resolve against that
// live gallery base and move the browser address out of the test tower.
export function stagingFloorUrl(pageHref,date,reception='__phi_reception__'){
 const page=new URL(pageHref);
 if(date===reception)page.searchParams.delete('date');
 else page.searchParams.set('date',date);
 return page.pathname+page.search+page.hash;
}
