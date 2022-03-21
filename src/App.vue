<template lang="pug">
  #app
    jm-header
    jm-notification(v-show="showNotification")
      p(slot="body") No se encontrarón resultados
    jm-loader(v-show="isLoading")
    section.section(v-show="!isLoading")
      nav.nav
        .container
          input.input.is-large(
            type="text",
            placeholder="Buscar canciones",
            v-model="searchQuery"
          )
          a.button.is-info.is-large(@click="search") Buscar
          a.button.is-danger.is-large &times;
      .container
        p
          small {{ searchMessage }}

      .container.results
        .columns.is-multiline
          .column.is-one-quarter(v-for="t in tracks")
            jm-track(
              :class="{ 'is-active': t.id === selectedTrack }",
              :track="t", 
              @select="setSelectedTrack")
    jm-footer
</template>

<script>
import trackService from '@/services/track'

import JmFooter from '@/components/layout/Footer.vue'
import JmHeader from '@/components/layout/Header.vue'

import JmTrack from '@/components/track.vue'

import JmNotification from '@/components/shared/Notification.vue'
import JmLoader from '@/components/shared/Loader.vue'

export default {
  name: 'App',
  components: {
    JmFooter,
    JmHeader,
    JmTrack,
    JmLoader,
    JmNotification
  },
  data () {
    return {
      searchQuery: '',
      tracks: [],
      isLoading: false,
      selectedTrack: '',
      showNotification: false
    }
  },
  computed: {
    searchMessage () {
      return `Encontrados: ${this.tracks.length}`
    }
  },
  watch: {
    showNotification () {
      if (this.showNotification) {
        setTimeout(() => {
          this.showNotification = false
        }, 3000)
      }
    }
  },
  methods: {
    search () {
      if (!this.searchQuery) { return }
      this.isLoading = true
      trackService.search(this.searchQuery)
        .then(res => {
          this.showNotification = res.tracks.total === 0
          this.tracks = res.tracks.items
          this.isLoading = false
        })
    },
    setSelectedTrack (trackId) {
      this.selectedTrack = trackId
    }
  }
}
</script>

<style lang="scss">
  @import './scss/main.scss';
  .results {
    margin-top: 50px;
  }
  .is-active {
    border: 3px #23d160 solid;
  }
</style>
