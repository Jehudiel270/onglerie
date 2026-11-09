import { usePublicOrigin } from './usePublicOrigin'

export function usePublicAssetUrl(path:string|undefined|null){
  if(!path)return undefined
  try{
    const origin=usePublicOrigin()
    const url=new URL(path,origin||undefined)
    return url.protocol==='https:'?url.toString():undefined
  }catch{return undefined}
}
