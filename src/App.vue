<template lang="pug">
  #app
    jm-header

    router-view
    
    jm-footer
</template>

<script>
import JmFooter from '@/components/layout/Footer.vue'
import JmHeader from '@/components/layout/Header.vue'

export default {
  name: 'app',
  components: { JmFooter, JmHeader }
}
</script>

<style lang="scss">
  @import './scss/main.scss';
</style>
