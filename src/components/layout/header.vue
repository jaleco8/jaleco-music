<template lang="pug">
  section.hero.is-success
    .hero-head
      header.nav
        .container
          .nav-left
            .nav-item
              strong Jaleco Music
          .nav-right.nav-menu
      .hero-body
        .container.has-text-centered
          h1.title Jaleco Music
          h2.subtitle Una plataforma de música para todos
          jm-player
</template>

<script>
import JmPlayer from '@/components/Player.vue'

export default {
  components: { JmPlayer }
}
</script>