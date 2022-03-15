import { Map, TileLayer, LineString } from 'maptalks'
import { ThreeLayer } from 'maptalks.three'
import {
  DirectionalLight,
  AmbientLight,
  MeshPhongMaterial,
  LineBasicMaterial,
  MeshBasicMaterial,
  AxesHelper,
  Vector2
} from 'three'
import { MeshLine, MeshLineMaterial } from 'three.meshline'

class DeferredPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = resolve
    })
  }
}

export default class ThreeMap {
  constructor(el, options, params) {
    this.container = el
    this.options = options
    this.params = {
      axesHelper: true,
      ...params
    }

    this.map = null
    this.threeLayer = null
    this.axesHelper = false

    this.material = null
    this.lineMaterial = null
    this.highlightMaterial = null

    this.extrudePolygons = null
    this.extrudePolygonsFlat = null
  }

  get mapCenter() {
    return this.map?.getCenter()
  }

  async init() {
    this.addMap(this.container, this.options)
    await this.addThreeLayer()

    return this
  }

  addMap() {
    this.map = new Map(this.container, {
      center: [37.33, 55.52],
      zoom: 9,
      minZoom: 9,
      maxZoom: 16,
      pitch: 34,
      dragRotate: false,
      dragPitch: false,
      touchZoom: false,
      doubleClickZoom: false,
      baseLayer: new TileLayer('base', {
        urlTemplate: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
        subdomains: ['a', 'b', 'c', 'd'],
        attribution:
          '&copy; <a href="http://osm.org">OpenStreetMap</a> ' +
          'contributors, &copy; <a href="https://carto.com/">CARTO</a>'
      }),
      ...this.options
    })
  }

  addThreeLayer() {
    console.log('add layer')
    const resolver = new DeferredPromise()
    const mapCenter = this.mapCenter
    let threeLayer

    this.threeLayer = threeLayer = new ThreeLayer('threeLayer', {
      forceRenderOnMoving: true,
      forceRenderOnRotating: true
    })

    threeLayer.prepareToDraw = (gl, scene) => {
      const light = new DirectionalLight(0xffffff)
      light.position.set(0, -10, 10).normalize()

      scene.add(light)
      scene.add(new AmbientLight(0xffffff, 0.2))

      if (this.params.axesHelper) {
        let axesHelper
        this.axishelper = axesHelper = new AxesHelper(1000000)

        axesHelper.position.copy(threeLayer.coordinateToVector3(mapCenter))
        threeLayer.addMesh(axesHelper)
      }

      resolver.resolve(threeLayer)
    }

    threeLayer.addTo(this.map)

    return resolver.promise
  }

  redrawThreeLayer() {
    const { threeLayer } = this

    this.threeLayer._needsUpdate = !threeLayer._needsUpdate

    if (threeLayer._needsUpdate) {
      threeLayer.redraw()
    }

    requestAnimationFrame(() => this.redrawThreeLayer())
  }

  getExtrudePolygons(geojson) {
    return geojson.features?.map((feature) => {
      return new ThreeMapArea(feature, this.threeLayer)
    })
  }

  drawPolygons(geojson) {
    this.extrudePolygons = this.getExtrudePolygons(geojson)

    this.threeLayer.addMesh(
      this.extrudePolygons.reduce((acc, e) => {
        acc.push(e.poly, ...e.polyLines)
        return acc
      }, [])
    )

    this.redrawThreeLayer()

    return this
  }

  on(event, callback) {
    this.extrudePolygons.forEach((e) => {
      e.poly.on(event, function () {
        callback(e)
      })
    })

    return this
  }
}

class ThreeMapArea {
  constructor(feature, threeLayer, options) {
    this.feature = feature
    this.threeLayer = threeLayer
    this.options = {
      height: 1000,
      color: 'aqua',
      ...options
    }

    this.resolution = new Vector2(window.innerWidth, window.innerHeight)
    this.material = new MeshPhongMaterial({})
    this.lineMaterial = new MeshLineMaterial({
      color: '#000',
      lineWidth: 200,
      resolution: this.resolution
    })
    this.highlightMaterial = new MeshBasicMaterial({
      color: 'yellow',
      transparent: true
    })

    // this.lineMaterial.resolution.set(window.innerWidth, window.innerHeight)

    console.log(this.lineMaterial)

    this.poly = null
    this.polyLines = null
    this.scale = 1

    this.init()
  }

  get object3d() {
    return this.poly?.getObject3d()
  }

  init() {
    const geometry = this.feature.geometry
    const lines = []

    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((coordinates) => {
        lines.push(new LineString(coordinates[0]))
      })
    } else {
      lines.push(new LineString(geometry.coordinates[0]))
    }

    this.poly = this.threeLayer.toExtrudePolygon(
      this.feature,
      {
        height: this.options.height,
        interactive: true,
        topColor: this.options.color
      },
      this.material
    )

    this.polyLines = lines.map((lineString) => {
      return this.threeLayer.toLine(
        lineString,
        { altitude: this.options.height, interactive: false },
        this.lineMaterial
      )
    })
  }

  animateMouseOver() {
    this.scale += 0.1
    this.object3d.scale.set(1, 1, this.scale)

    this.polyLines.forEach((e) => {
      e.setAltitude(this.scale * 1000)
    })

    if (this.scale >= 1.5) return

    requestAnimationFrame(this.animateMouseOver.bind(this))
  }

  animateMouseOut() {
    this.scale -= 0.1
    this.object3d.scale.set(1, 1, this.scale)

    this.polyLines.forEach((e) => {
      e.setAltitude(this.scale * 1000)
    })

    if (this.scale <= 1) return

    requestAnimationFrame(this.animateMouseOut.bind(this))
  }

  highlight() {
    this.poly.setSymbol(this.highlightMaterial)
  }

  fade() {
    this.poly.setSymbol(this.material)
  }
}
