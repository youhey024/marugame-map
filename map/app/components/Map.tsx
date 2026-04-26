'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function Map() {
  useEffect(() => {
    const map = L.map('map').setView([35.9, 139.6], 11) // 埼玉中心

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  return <div id="map" style={{ height: '100vh', width: '100%' }} />
}