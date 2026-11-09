<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description?: string }>()
</script>

<template>
  <section class="page-intro container-page">
    <div class="page-intro__inner"><div><span class="eyebrow">{{ eyebrow }}</span><h1 class="display">{{ title }}</h1></div><p v-if="description">{{ description }}</p></div>
  </section>
</template>
