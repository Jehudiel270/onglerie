<script setup lang="ts">
import { ArrowDown, ArrowRight, ArrowUpRight, Sparkles } from '@lucide/vue'
import type { PublicCatalog } from '~~/shared/types/catalog'

type PublicContent = { siteName: string; headline?: string; intro?: string; heroImage?: string; demo?: boolean; configured?:boolean; phone?:string; email?:string; address?:string; city?:string; country?:string }
const [{ data: catalog }, { data: content }] = await Promise.all([
  useFetch<PublicCatalog>('/api/public/catalog', { key: 'public-catalog' }),
  useFetch<PublicContent>('/api/public/content', { key: 'salon-public-content' }),
])
const featuredServices = computed(() => (catalog.value?.services ?? []).filter((service) => service.featured).slice(0, 3))
const featuredLooks = computed(() => (catalog.value?.portfolio ?? []).filter((item) => item.featured).slice(0, 3))
const siteName = computed(() => content.value?.siteName || catalog.value?.salonName || 'Votre onglerie')
const heroImage = computed(() => content.value?.heroImage || '/images/editorial-hero.webp')
const siteUrl = usePublicOrigin()
const { appearance } = useSiteAppearance()
const heroImageUrl = usePublicAssetUrl(heroImage.value)
const homeTitle = `${siteName.value} — La beauté des mains, pensée pour vous`
const homeDescription = 'Découvrez les prestations, explorez les inspirations et préparez votre prochain rendez-vous ongulaire au Bénin.'
useSeoMeta({ title: homeTitle, description: homeDescription, ogType: 'website', ogTitle: homeTitle, ogDescription: homeDescription, ogSiteName: siteName.value, ogImage: heroImageUrl, twitterCard: 'summary_large_image', twitterTitle: homeTitle, twitterDescription: homeDescription, twitterImage: heroImageUrl })
const businessJsonLd=computed(()=>{
  const current=content.value
  if(!siteUrl||!current?.configured||current.demo||!current.siteName||(!current.phone&&!current.email&&!current.address&&!current.city))return''
  const schema={ '@context':'https://schema.org','@type':'NailSalon',name:current.siteName,url:siteUrl,...(heroImageUrl?{image:heroImageUrl}:{}),...(current.phone?{telephone:current.phone}:{}),...(current.email?{email:current.email}:{}),...(current.address||current.city?{address:{'@type':'PostalAddress',...(current.address?{streetAddress:current.address}:{}),...(current.city?{addressLocality:current.city}:{}),addressCountry:current.country||'BJ'}}:{}) }
  return JSON.stringify(schema).replaceAll('<','\\u003c')
})
useHead(()=>({script:businessJsonLd.value?[{type:'application/ld+json',innerHTML:businessJsonLd.value}]:[]}))
</script>

<template>
  <div>
    <section v-reveal class="hero container-page">
      <div class="hero__copy">
        <span class="eyebrow">Un studio · Une pose pensée pour vous</span>
        <h1 class="display">La beauté des mains,<br><em>pensée pour vous.</em></h1>
        <p>Explorez les styles, choisissez votre prestation et préparez votre rendez-vous avec clarté, du premier regard au dernier détail.</p>
        <div class="hero__actions"><NuxtLink class="btn btn-primary" to="/reservation">Choisir mon rendez-vous <ArrowRight :size="16" /></NuxtLink><NuxtLink class="link-arrow" to="/realisations">Parcourir les inspirations <ArrowUpRight :size="15" /></NuxtLink></div>
        <div class="hero__footnote"><span class="hero__sparkle"><Sparkles :size="15" /></span><span>Un espace pensé autour du geste, de la matière et de votre style.</span></div>
      </div>
      <div class="hero__visual">
        <div class="hero__photo-frame"><img :src="heroImage" :alt="`Composition éditoriale autour du soin des mains — ${siteName}`" width="1100" height="1360" fetchpriority="high" decoding="async"><span class="hero__photo-note">L’ART DU DÉTAIL <b>·</b> BEAUTÉ DES MAINS</span></div>
        <div class="hero__seal" aria-hidden="true"><span>POSE<br>AVEC<br>INTENTION</span><i /></div>
        <div class="hero__side-label">BENIN · STUDIO ONGULAIRE</div>
      </div>
      <a class="hero__scroll" href="#prestations" aria-label="Défiler vers les prestations"><span>FAITES DÉFILER</span><ArrowDown :size="14" /></a>
    </section>

    <section v-if="catalog?.demo" v-reveal class="container-page demo-banner" aria-label="Données de démonstration"><div><strong>Aperçu de démonstration</strong><span>Les tarifs sont indicatifs et les images ont été créées pour la maquette éditoriale. Rien ici ne représente une prestation réellement réalisée ou confirmée par le salon.</span></div><NuxtLink to="/contact">Personnaliser le salon <ArrowUpRight :size="14" /></NuxtLink></section>

    <section v-if="appearance.nailExperienceEnabled" class="home-stage container-page"><NailStage :settings="appearance" /></section>

    <section v-reveal id="prestations" class="home-services container-page section-block">
      <div class="section-topline"><span class="section-kicker">Le rituel, à votre rythme</span><NuxtLink class="link-arrow" to="/prestations">Toutes les prestations <ArrowRight :size="15" /></NuxtLink></div>
      <div class="section-heading-row"><h2 class="section-heading">Un soin juste.<br><em>Votre signature.</em></h2><p class="section-copy">Parcourez les options, leurs durées et leurs tarifs. Les détails définitifs sont configurés par l’équipe du salon.</p></div>
      <div v-if="featuredServices.length" class="services-grid"><ServiceCard v-for="service in featuredServices" :key="service.id" :service="service" :demo="Boolean(catalog?.demo)" /></div>
      <div v-else class="empty-state"><strong>Les prestations arrivent ici.</strong><p>Le catalogue n’a pas encore été renseigné par l’équipe du salon.</p><NuxtLink class="link-arrow" to="/contact">Demander des informations <ArrowRight :size="15" /></NuxtLink></div>
    </section>

    <section v-reveal class="inspiration-section">
      <div class="container-page inspiration-section__inner">
        <div class="section-topline"><span class="section-kicker">Couleurs · Formes · Finitions</span><NuxtLink class="link-arrow" to="/realisations">Toutes les inspirations <ArrowRight :size="15" /></NuxtLink></div>
        <div class="section-heading-row"><h2 class="section-heading">Un détail<br><em>qui change tout.</em></h2><p class="section-copy">Explorez des pistes de style, puis gardez une référence pour expliquer ce que vous aimez au moment du rendez-vous.</p></div>
        <div v-if="featuredLooks.length" class="looks-grid"><PortfolioCard v-for="item in featuredLooks" :key="item.id" :item="item" :demo="Boolean(catalog?.demo)" /></div>
        <div v-else class="empty-state"><strong>Pas encore de références publiées.</strong><p>Les photos apparaîtront ici lorsque l’équipe les aura ajoutées au portfolio.</p></div>
      </div>
    </section>

    <section v-reveal class="home-clarity container-page">
      <div class="home-clarity__title"><span class="eyebrow">Du premier clic au rendez-vous</span><h2 class="display">Tout est plus simple<br>quand tout est clair.</h2></div>
      <div class="clarity-points"><article><b>01</b><h3>Choisissez votre pose</h3><p>Comparez les prestations, les durées et le prix indiqué par le salon.</p></article><article><b>02</b><h3>Gardez une référence</h3><p>Ajoutez une inspiration publiée à votre demande pour guider l’échange.</p></article><article><b>03</b><h3>Réservez en confiance</h3><p>Le calendrier ne propose que les créneaux calculés à partir des horaires configurés.</p></article></div>
    </section>

    <section v-reveal class="home-cta container-page"><div class="home-cta__content"><span class="eyebrow">Le prochain détail vous attend</span><h2 class="display">Votre moment.<br><em>Votre manière.</em></h2><p>Commencez par choisir ce qui vous ressemble.</p><NuxtLink class="btn btn-light" to="/reservation">Explorer les créneaux <ArrowRight :size="16" /></NuxtLink></div><span class="home-cta__mark" aria-hidden="true">N°01</span></section>
  </div>
</template>

<style scoped>
.hero{position:relative;display:grid;min-height:min(760px,calc(100svh - 82px));grid-template-columns:1.02fr .98fr;align-items:center;gap:clamp(2rem,6vw,6rem);padding-top:2.6rem;padding-bottom:5.8rem}.hero__copy{position:relative;z-index:2;padding:3rem 0 2rem}.hero h1{margin:1.2rem 0 1.4rem;font-size:clamp(3.8rem,7vw,7.2rem)}.hero h1 em,.section-heading em{color:var(--merlot);font-weight:400}.hero__copy>p{max-width:450px;color:var(--muted);font-size:clamp(.92rem,1.4vw,1.05rem)}.hero__actions{display:flex;flex-wrap:wrap;align-items:center;gap:1.4rem;margin-top:1.7rem}.hero__actions .btn{min-height:54px;padding-inline:1.4rem}.hero__actions .link-arrow{font-size:.72rem}.hero__footnote{display:flex;max-width:340px;align-items:center;gap:.7rem;margin-top:3.5rem;color:#887b73;font-size:.66rem;line-height:1.5}.hero__sparkle{display:grid;width:32px;height:32px;flex:0 0 32px;place-items:center;border:1px solid rgba(107,45,69,.19);border-radius:50%;color:var(--merlot)}.hero__visual{position:relative;width:100%;max-width:520px;justify-self:end}.hero__photo-frame{position:relative;width:86%;height:min(630px,72vh);min-height:470px;overflow:hidden;border-radius:48% 48% 1.2rem 1.2rem;background:#e2d3cf;box-shadow:0 30px 80px rgba(60,31,39,.15)}.hero__photo-frame:after{position:absolute;inset:0;border:1px solid rgba(255,255,255,.4);border-radius:inherit;content:""}.hero__photo-frame img{width:100%;height:100%;object-fit:cover;object-position:center}.hero__photo-note{position:absolute;bottom:1rem;left:1rem;color:white;font-size:.53rem;font-weight:700;letter-spacing:.18em;text-shadow:0 1px 8px rgba(20,10,12,.6)}.hero__photo-note b{padding:0 .35rem;color:#f6dfe0}.hero__seal{position:absolute;right:0;bottom:9%;display:grid;width:125px;height:125px;place-items:center;border:1px solid rgba(107,45,69,.27);border-radius:50%;color:var(--merlot);background:rgba(245,240,233,.95);font-size:.56rem;font-weight:800;letter-spacing:.15em;line-height:1.5;text-align:center;transform:rotate(10deg)}.hero__seal i{position:absolute;inset:8px;border:1px dashed rgba(107,45,69,.35);border-radius:50%}.hero__side-label{position:absolute;top:11%;right:3%;color:rgba(67,48,49,.6);font-size:.55rem;font-weight:700;letter-spacing:.2em;writing-mode:vertical-rl}.hero__scroll{position:absolute;bottom:1.8rem;left:0;display:flex;align-items:center;gap:.65rem;color:#867970;font-size:.54rem;font-weight:700;letter-spacing:.16em}.demo-banner{display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid #dfcda9;border-radius:.85rem;padding:.8rem 1rem;color:#664f37;background:#f7efdf}.demo-banner>div{display:grid;gap:.15rem}.demo-banner strong{font-size:.72rem}.demo-banner span{font-size:.68rem;line-height:1.45}.demo-banner>a{display:inline-flex;flex:0 0 auto;align-items:center;gap:.35rem;color:#6b2d45;font-size:.68rem;font-weight:800}.section-block{padding-top:6.2rem;padding-bottom:2rem}.section-topline{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding-top:1rem}.section-topline .link-arrow{font-size:.68rem}.section-heading-row{display:flex;align-items:end;justify-content:space-between;gap:2rem;margin:1.6rem 0 2.5rem}.section-heading{font-size:clamp(3.1rem,6vw,5.3rem)}.section-copy{max-width:390px;margin-bottom:.3rem;font-size:.83rem}.services-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem}.home-stage{padding-top:1rem}.inspiration-section{padding:4.5rem 0 6rem;background:#eee5de}.inspiration-section__inner{padding-top:1rem}.looks-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem}.looks-grid>*:nth-child(2){margin-top:2.8rem}.looks-grid>*:nth-child(3){margin-top:1.2rem}.home-clarity{display:grid;grid-template-columns:.8fr 1.2fr;gap:4rem;padding-top:7rem;padding-bottom:7rem}.home-clarity__title h2{margin:.9rem 0;font-size:clamp(3rem,5vw,4.6rem)}.clarity-points{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem}.clarity-points article{border-top:1px solid var(--line);padding-top:.9rem}.clarity-points b{color:var(--rose);font-family:var(--font-display);font-size:1.2rem}.clarity-points h3{margin:.85rem 0 .4rem;font-family:var(--font-display);font-size:1.45rem;line-height:1.05}.clarity-points p{color:var(--muted);font-size:.72rem;line-height:1.6}.home-cta{position:relative;overflow:hidden;border-radius:1.6rem;padding:4rem 5rem;color:#fff7f1;background:radial-gradient(circle at 84% 15%,rgba(203,137,154,.46),transparent 27%),linear-gradient(118deg,#4b2635,#71324c 62%,#482432)}.home-cta:after{position:absolute;top:-25%;right:8%;width:380px;height:150%;border:1px solid rgba(255,255,255,.12);border-radius:50%;content:"";transform:rotate(34deg)}.home-cta__content{position:relative;z-index:1}.home-cta .eyebrow{color:#e8bec5}.home-cta h2{margin:1rem 0 .6rem;font-size:clamp(3.5rem,6vw,5.5rem)}.home-cta h2 em{color:#e4bcc2;font-weight:400}.home-cta p{margin-bottom:1.5rem;color:#e0d0cc;font-size:.83rem}.home-cta__mark{position:absolute;right:4rem;bottom:1.2rem;color:rgba(255,255,255,.09);font-family:var(--font-display);font-size:9rem;line-height:1}
@media(max-width:850px){.hero{min-height:auto;grid-template-columns:1fr 1fr;gap:1.5rem;padding-top:1.2rem}.hero h1{font-size:clamp(3.3rem,8vw,5.6rem)}.hero__photo-frame{min-height:420px;height:55vh}.services-grid,.looks-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.looks-grid>*:nth-child(3){display:none}.home-clarity{grid-template-columns:1fr;gap:2rem;padding-block:5rem}}
@media(max-width:620px){.hero{grid-template-columns:1fr;gap:0;padding-top:.6rem;padding-bottom:4rem}.hero__copy{padding:2rem 0 1.25rem}.hero h1{font-size:clamp(3.35rem,13vw,5rem)}.hero__copy>p{font-size:.87rem}.hero__actions{align-items:flex-start;gap:1rem;flex-direction:column}.hero__footnote{margin-top:1.6rem}.hero__visual{width:90%;max-width:420px;justify-self:center}.hero__photo-frame{width:88%;height:430px;min-height:0}.hero__seal{width:100px;height:100px;font-size:.47rem}.hero__side-label{top:15%;right:0}.hero__scroll{bottom:1rem}.demo-banner{align-items:flex-start;flex-direction:column}.section-block{padding-top:4rem}.section-heading-row{display:block;margin-bottom:1.5rem}.section-heading{font-size:3.5rem}.section-copy{margin-top:1rem}.services-grid,.looks-grid{grid-template-columns:1fr;gap:1rem}.looks-grid>*:nth-child(2){margin-top:0}.looks-grid>*:nth-child(3){display:block;margin-top:0}.service-card__image{height:320px}.inspiration-section{padding-block:3.4rem}.home-clarity{padding-block:4rem}.clarity-points{grid-template-columns:1fr;gap:1rem}.clarity-points article{display:grid;grid-template-columns:35px 1fr;column-gap:.7rem}.clarity-points article b{grid-row:span 2}.clarity-points h3{margin:.1rem 0}.clarity-points p{margin:.2rem 0 .35rem}.home-cta{padding:3rem 1.4rem}.home-cta__mark{right:1rem;font-size:6rem}}
</style>
