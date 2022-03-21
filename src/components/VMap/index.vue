<template>
  <div class="v-map" ref="container"></div>
</template>

<script>
  import { defineComponent } from 'vue'
  import ThreeMap from './ThreeMap'

  export default defineComponent({
    name: 'VMap',

    data: () => ({
      map: null
    }),

    props: {
      geojson: Object
    },

    mounted() {
      const map = new ThreeMap(this.$refs.container)

      this.map = map

      map.init().then((map) => {
        map
          .drawAreas(this.geojson)
          .on('add', (area) => {
            console.log(area)
          })
          .on('mouseover', (area) => {
            area.highlight()
            area.animateMouseOver()
          })
          .on('mouseout', (area) => {
            area.fade()
            area.animateMouseOut()
          })
      })

      window.__threeMap = map
    }
  })
</script>

<style>
  .v-map {
    position: relative;
    width: 100vw;
    height: 100vh;
  }
</style>
