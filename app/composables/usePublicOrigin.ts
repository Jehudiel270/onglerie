export function usePublicOrigin(){
  const config=useRuntimeConfig()
  try{
    const url=new URL(String(config.public.siteUrl||''))
    if(url.protocol!=='https:'||url.username||url.password)return''
    return url.origin
  }catch{return''}
}
