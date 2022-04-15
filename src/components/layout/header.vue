<template lang="pug">
  section.hero.is-success
    .hero-head
      header.navbar
        .container
          .nav-start
            .nav-item
              strong 📻 Jaleco Music
          .navbar-end.navbar-menu
            router-link.navbar-item(to="/") Buscar
            router-link.navbar-item(to="about") Nosotros
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