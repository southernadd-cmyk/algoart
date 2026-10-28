import {generateTouchDesignerJob,isValidISODate} from './touchdesigner-daily.mjs';
const argIndex=process.argv.indexOf('--date');
const date=argIndex>=0?process.argv[argIndex+1]:process.argv[2];
if(!isValidISODate(date)){console.error('Usage: node automation/build-touchdesigner-job.mjs --date YYYY-MM-DD');process.exit(2);}
const job=await generateTouchDesignerJob(date);
console.log('Prepared TouchDesigner job for '+job.date+': '+job.artwork.title+' ('+job.artwork.seed+')');
console.log('Source: '+job.artwork.sourceURL);
console.log('Local TouchDesigner render is NOT triggered by this GitHub workflow.');
