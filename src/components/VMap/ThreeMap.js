import { Map, TileLayer, LineString } from 'maptalks'
import { ThreeLayer, LineMaterial } from 'maptalks.three'
import {
  DirectionalLight,
  AmbientLight,
  MeshPhongMaterial,
  MeshBasicMaterial,
  AxesHelper
} from 'three'
// import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
// import { debounce } from 'lodash'

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

    this._focusedAreas = []
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

  drawAreas(geojson) {
    this.extrudePolygons = this.getExtrudePolygons(geojson)

    this.threeLayer.addMesh(
      this.extrudePolygons.reduce((acc, e) => {
        acc.push(e.poly, e.polyLine)
        return acc
      }, [])
    )

    this.redrawThreeLayer()

    return this
  }

  on(event, callback) {
    // const throttledCb = debounce(callback, 200, { trailing: true })

    this.extrudePolygons.forEach((area) => {
      area.poly.on(event, () => {
        // console.log(e)
        // if (!e.coordinate)

        // const intersects = e.coordinate
        //   ? this.threeLayer.identify(e.coordinate, { count: 10 })
        //   : []
        // console.log(intersects, event)
        // if (intersects.length > 1) return
        // if (event === 'mouseout' && intersects.length) {
        //   intersects[0].fire('mouseover')
        //   return
        // }

        // switch (event) {
        //   case 'mouseover':
        //     if (intersects.length) intersects[0].fire('mouseover')
        //     else throttledCb(area)
        //     break
        //   case 'mouseout':
        //     callback(area)
        // }

        callback(area)

        // console.log(e)
        // console.log(this.threeLayer.identify(e.coordinate, { count: 10 }))
      })
    })

    return this
  }
}

const AREA_MATERIAL = new MeshPhongMaterial({ color: 'aqua' })
const AREA_LINE_MATERIAL = new LineMaterial({
  color: '#000',
  linewidth: 1,
  opacity: 1,
  // worldUnits: false,
  polygonOffset: true,
  polygonOffsetFactor: -3
})
const AREA_HIGHLIGHT_MATERIAL = new MeshBasicMaterial({
  color: 'yellow'
})

class ThreeMapArea {
  constructor(feature, threeLayer, options) {
    this.feature = feature
    this.threeLayer = threeLayer
    this.options = {
      height: 1000,
      color: 'aqua',
      ...options
    }

    this.material = AREA_MATERIAL
    this.lineMaterial = AREA_LINE_MATERIAL
    this.highlightMaterial = AREA_HIGHLIGHT_MATERIAL

    this.poly = null
    this.polyLine = null
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
        interactive: true
        // topColor: this.options.color
      },
      this.material
    )

    this.polyLine = this.threeLayer.toFatLines(
      lines,
      {
        altitude: this.options.height + 1,
        interactive: false
      },
      this.lineMaterial
    )
  }

  animateScale(scale) {
    this.scale = scale
    this.object3d.scale.set(1, 1, scale)
    this.polyLine.setAltitude(scale * 1000 + 1)
  }

  animateMouseOver() {
    const scale = this.scale + 0.1

    if (scale >= 2) {
      this.animateScale(2)
      return
    }

    this.animateScale(scale)
    requestAnimationFrame(this.animateMouseOver.bind(this))
  }

  animateMouseOut() {
    const scale = this.scale - 0.1

    if (scale <= 1) {
      this.animateScale(1)
      return
    }

    this.animateScale(scale)
    requestAnimationFrame(this.animateMouseOut.bind(this))
  }

  highlight() {
    this.poly.setSymbol(this.highlightMaterial)
  }

  fade() {
    this.poly.setSymbol(this.material)
  }
}
