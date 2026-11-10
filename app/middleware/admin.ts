export default defineNuxtRouteMiddleware(async(to)=>{
  try{
    const session=await useRequestFetch()<{role?:string}>('/api/admin/session')
    if(session?.role==='staff')return navigateTo('/staff',{replace:true})
  }catch{return navigateTo({path:'/connexion',query:{redirect:to.fullPath}})}
})
