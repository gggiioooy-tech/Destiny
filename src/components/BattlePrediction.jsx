import React,{useEffect,useRef,useState} from 'react';
import validation from '../lib/simulationValidation.json';

export default function BattlePrediction({draft,plans,seed,disabled,exampleCount}){
  const worker=useRef(null),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  function stop(){worker.current?.terminate();worker.current=null;setBusy(false);}
  useEffect(()=>()=>worker.current?.terminate(),[]);
  useEffect(()=>{worker.current?.terminate();worker.current=null;setBusy(false);setResult(null);setError('');},[draft,plans,seed]);
  useEffect(()=>{if(disabled){worker.current?.terminate();worker.current=null;setBusy(false);}},[disabled]);
  function run(){
    stop();setResult(null);setError('');setBusy(true);
    try{
      const job=new Worker(new URL('../lib/battlePrediction.worker.js',import.meta.url),{type:'module'});worker.current=job;
      job.onmessage=({data})=>{
        if(worker.current!==job)return;
        if(data.result)setResult(data.result);
        if(data.error)setError(data.error);
        if(data.done)stop();
      };
      job.onerror=()=>{if(worker.current===job){setError('반복 계산에 실패했습니다. 편성을 확인해 주세요.');stop();}};
      job.postMessage({draft,plans,seed,samples:100});
    }catch{setError('이 브라우저에서 반복 계산을 시작할 수 없습니다.');stop();}
  }
  const percent=n=>(n*100).toFixed(0)+'%';
  return <section className="sim-prediction" aria-label="승패 반복 계산">
    <p className="sim-error-banner">실전 예측 기준 미달 · 현재 엔진의 기존 기록 재검사 {validation.downloadedRecords}개 중 비교 가능한 {validation.eligibleRecords}전에서 {validation.correct}전 일치 ({Math.round(validation.correct/validation.eligibleRecords*100)}%). 독립 검증이 아니며 90% 정확도를 달성하지 못했습니다.</p>
    <div className="sim-setup-toolbar"><div><h3>승패 반복 계산</h3><p>같은 편성으로 난수 100개를 계산합니다. 실제 적중률은 별도 검증이 필요합니다.</p></div><div><button type="button" className="sim-button sim-button-primary" disabled={disabled||busy||exampleCount>0} onClick={run}>100회 비교</button><button type="button" className="sim-button" disabled={!busy} onClick={stop}>계산 중지</button></div></div>
    {exampleCount>0&&<p>예시 스탯을 실제 전투 시작 스탯으로 바꾼 뒤 사용할 수 있습니다.</p>}
    {error&&<p role="alert">{error}</p>}
    {result&&<div role="status" aria-live="polite"><strong>{busy?'계산 중':result.total<100?'중단된 계산':'계산 완료'} · {result.total}/100회</strong><div className="sim-speed-summary"><span>공격팀 승리 <b>{percent(result.attackerRate)}</b></span><span>방어팀 승리 <b>{percent(result.defenderRate)}</b></span><span>판정 불가 <b>{result.unresolved}회</b></span></div><p>미결 전투를 포함한 공격팀 승률 범위: {result.attackerBounds.map(percent).join(' ~ ')}. {result.total===100&&result.winner?`${result.winner==='attacker'?'공격':'방어'}팀이 모델에서 더 자주 이겼습니다.`:'완료된 반복 계산만으로 우세를 단정할 수 없습니다.'}</p><small>이 수치는 모델 내부 승률입니다. 실제 전투 예측 정확도 90%를 의미하지 않습니다. 누락된 스킬·장비·펫 효과가 결과를 바꿀 수 있습니다.</small></div>}
  </section>;
}
