export default defineNuxtRouteMiddleware(async(to)=>{
  try{await useRequestFetch()('/api/account/session')}
  catch{return navigateTo({path:'/connexion',query:{redirect:to.fullPath}})}
})
