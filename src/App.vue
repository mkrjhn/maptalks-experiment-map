<template>
  <!-- <main class="map-container" ref="container"></main> -->
  <v-map :geojson="moscowGeojson" />
</template>

<script setup>
  import VMap from '@/components/VMap/index.vue'
  import moscowGeojson from '@/static/ao.json'
</script>

<style>
  @import './assets/base.css';

  html,
  body {
    margin: 0;
    padding: 0;
  }

  .map-container {
    position: relative;
    width: 100vw;
    height: 100vh;
  }
</style>
