export function parseRuns(raw){
  if(raw===undefined)return 3;
  const count=Number(raw);
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(count)||count<1)throw new RangeError('Invalid --runs: expected a positive safe integer (for example --runs=3).');
  return count;
}

export function median(values){
  if(!values.length||values.some(value=>!Number.isFinite(value)))throw new RangeError('Median requires at least one finite sample.');
  const sorted=[...values].sort((first,second)=>first-second),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
