import {simulateSample,summarizePrediction} from './battlePrediction.js';
self.onmessage=({data})=>{
  try{
    const {draft,plans,seed,samples}=data;
    if(!Number.isInteger(samples)||samples<1||samples>1000)throw Error('잘못된 반복 횟수');
    const counts={attacker:0,defender:0,unresolved:0};
    for(let i=0;i<samples;i++){
      counts[simulateSample(draft,plans,i,seed)]++;
      if((i+1)%10===0||i+1===samples)self.postMessage({result:summarizePrediction(counts),done:i+1===samples});
    }
  }catch(e){self.postMessage({error:e.message,done:true});}
};
