const nonce=new URLSearchParams(location.hash.slice(1)).get('nonce');
if(/^[a-f0-9]{64}$/.test(nonce||'')){
  setTimeout(()=>location.replace('http://127.0.0.1:15150/connect#'+new URLSearchParams({nonce,origin:location.origin})),6000);
}
