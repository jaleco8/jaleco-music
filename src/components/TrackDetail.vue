<template lang="pug">
  .container
    .columns
      .column.is-5.is-offset-4
        jm-track(:track="track")
</template>

<script>
import trackService from '@/services/track'
import JmTrack from '@/components/Track.vue'
export default {
  components: { JmTrack },
  data () {
    return {
      track: {}
    }
  },
  created () {
    const id = this.$route.params.id
    trackService.getById(id)
      .then(res => {
        this.track = res
      })
  }
}
</script>

<style lang="scss" scope>
  .columns {
    margin: 2rem;
  }
</style>