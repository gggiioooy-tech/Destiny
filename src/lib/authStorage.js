export const KEEP_LOGIN_KEY='15month_keep_login';
export function createAuthStorage(local,session){
  const memory=new Map();
  const fallback={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const available=store=>{try{const key='15month_storage_probe';store.setItem(key,'1');store.removeItem(key);return store;}catch{return null;}};
  const temporary=available(session)||fallback,persistent=available(local);
  const keeping=()=>{try{return persistent?.getItem(KEEP_LOGIN_KEY)==='true';}catch{return false;}};
  const selected=()=>keeping()?persistent:temporary;
  return {
    getItem:key=>selected().getItem(key),
    setItem:(key,value)=>selected().setItem(key,value),
    removeItem(key){temporary.removeItem(key);persistent?.removeItem(key);if(key==='15month_secure_auth')persistent?.removeItem(KEEP_LOGIN_KEY);},
    keeping,
    setKeeping(enabled,key='15month_secure_auth'){
      // Move any current session, never a password, before changing storage.
      if(enabled&&!persistent)throw Error('이 브라우저에서는 로그인 유지 저장소를 사용할 수 없습니다.');
      const value=selected().getItem(key);
      temporary.removeItem(key);persistent?.removeItem(key);
      if(enabled)persistent.setItem(KEEP_LOGIN_KEY,'true');else persistent?.removeItem(KEEP_LOGIN_KEY);
      if(value)selected().setItem(key,value);
    },
  };
}
