<template lang="pug">
  #app
    jm-header
    section.section
      nav.nav.has-shadow
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
        .columns
          .column(v-for="t in tracks") 
            | {{ t.name }} - {{ t.artists[0].name }}
    jm-footer
</template>

<script>
import trackService from './services/track'
import JmFooter from './components/layout/footer.vue'
import JmHeader from './components/layout/header.vue'

export default {
  name: 'App',
  components: {
    JmFooter,
    JmHeader
  },
  data () {
    return {
      searchQuery: '',
      tracks: []
    }
  },
  computed: {
    searchMessage () {
      return `Encontrados: ${this.tracks.length}`
    }
  },

  methods: {
    search () {
      if (!this.searchQuery) { return }
      trackService.search(this.searchQuery)
        .then(res => {
          this.tracks = res.tracks.items
        })
    }
  }
}
</script>

<style lang="scss">
  @import './scss/main.scss';
  .results {
    margin-top: 50px;
  }
</style>
