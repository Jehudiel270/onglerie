export default defineNuxtRouteMiddleware(async(to)=>{
  try{await useRequestFetch()('/api/staff/session')}
  catch(error){
    // Double vérification en attente : étape du code e-mail, pas une déconnexion.
    const code=(error as {data?:{code?:string}})?.data?.code
    if(code==='OTP_REQUIRED')return navigateTo({path:'/connexion/verification',query:{redirect:to.fullPath}})
    return navigateTo({path:'/connexion',query:{redirect:to.fullPath}})
  }
})
