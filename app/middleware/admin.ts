export default defineNuxtRouteMiddleware(async(to)=>{
  try{await useRequestFetch()('/api/admin/session')}
  catch{return navigateTo({path:'/connexion',query:{redirect:to.fullPath}})}
})
