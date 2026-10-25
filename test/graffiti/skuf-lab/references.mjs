// Research sources, not a dataset of verified individual handwriting specimens.
// A site or interview may contain multiple photographs of varying categories.
// Curate image-level samples manually before claiming an observed letter shape.
export const REFERENCE_TARGET={minimum:15,ideal:25};
export const SKUF_SOURCES=Object.freeze([
 {id:'vice-2016',title:'What Happens When a Legendary Graffiti Writer Grows Up',publisher:'VICE / Ray Mock',date:'2016-06-07',
  url:'https://www.vice.com/en/article/skuf-what-happens-when-a-legendary-graffiti-writer-grows-up/',
  category:'mixed',priority:'high',status:'source-verified',
  evidence:'Text describes a swooping tag S; flattened S, compressed K/U and elongated F specifically describe a throw-up, NOT automatically the handstyle.',
  limitation:'Interview photographs are mixed media. Select and classify individual photos first.'},
 {id:'carnage-2015',title:'December 3: SKUF YKK',publisher:'Carnage NYC / Ray Mock',date:'2015-12-03',
  url:'https://carnagenyc.com/home/2015/12/3/december-3-skuf-ykk',
  category:'paper-and-pieces',priority:'high',status:'source-verified',
  evidence:'Publisher reports original SKUF drawings and separate handstyles on paper; possible high-quality handstyle references.',
  limitation:'The article alone does not document full stroke order or a complete alphabet.'},
 {id:'stomp-2016-marker',title:'SKUFER — gold marker tag',publisher:'The Great Gallery of Graffiti',date:'2016-08-14',
  url:'https://graffiti.stompandcrush.com/tag/skuf-ykk-2/',
  category:'marker-tag',priority:'high',status:'source-verified',
  evidence:'Archive explicitly captions a SKUF quick gold marker tag.',
  limitation:'Archive contains many works; inspect exact photograph and legibility before annotation.'},
 {id:'stomp-2017-classic',title:'SKUF YKK — classic style',publisher:'The Great Gallery of Graffiti / @monolaps',date:'2017-08-16',
  url:'https://graffiti.stompandcrush.com/tag/skuf-ykk-2/',
  category:'unclassified',priority:'high',status:'source-verified',
  evidence:'Archive credits photographer and describes a classic SKUF example.',
  limitation:'Must decide whether the particular work is a handstyle or throw-up.'},
 {id:'stomp-2017-mixed',title:'ANICE / SINCE / FORE / SKUF / TAKE',publisher:'The Great Gallery of Graffiti',date:'2017-07-28',
  url:'https://graffiti.stompandcrush.com/tag/ykk/',
  category:'mixed-wall',priority:'medium',status:'source-verified',
  evidence:'Group photo described as including small SKUF tags alongside other writers.',
  limitation:'Cannot attribute strokes until isolated visually.'},
 {id:'rooftop-2010',title:'SKUF YKK — Rooftop Legends',publisher:'Rooftop Legends',date:'2010-06',
  url:'https://rooftoplegends2010.blogspot.com/2010/06/skuf-ykk.html',
  category:'unclassified',priority:'medium',status:'awaiting-image-audit',
  evidence:'Historical SKUF wall example referenced in earlier study.',
  limitation:'Direct reference media and its type have not been re-verified.'},
 {id:'drips-2018',title:'SKUF on New York graffiti in the 1990s',publisher:'DRIPS',date:'2018-04-27',
  url:'https://www.drips.fr/destruction-style-violence-skuf-raconte-le-graffiti-a-new-york-dans-les-90s/',
  category:'mixed',priority:'medium',status:'source-verified',
  evidence:'Interview about period and writing context.',
  limitation:'Do not treat narrative or throw-up imagery as handstyle stroke evidence.'}
]);
export const OBSERVATION_FIELDS=Object.freeze(['sourceId','imageDescription','medium','word','lettersVisible','contour','connections','terminal','confidence','geometry','inferredMotion','reviewedBy']);
export function describeCoverage(annotations=[]){
 const confirmed=annotations.filter(a=>a.reviewedBy&&a.confidence!=='unknown'&&a.medium==='handstyle');
 return {sourcePages:SKUF_SOURCES.length,handstyleExamples:confirmed.length,needed:Math.max(0,REFERENCE_TARGET.minimum-confirmed.length)};
}
