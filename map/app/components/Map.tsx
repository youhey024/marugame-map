'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function Map() {
  useEffect(() => {
    // アイコンのパス修正
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map('map').setView([35.9, 139.6], 11)
    let isMounted = true

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    fetch('/shops.json')
      .then(res => res.json())
      .then(shops => {
        if (!isMounted) return  
        shops.forEach((shop: { name: string; address: string; lat: number; lng: number }) => {
          L.marker([shop.lat, shop.lng])
            .addTo(map)
            .bindPopup(`<b>${shop.name}</b><br>${shop.address}`)
        })
      })

    return () => {
    isMounted = false  // 追加
    map.remove()
  }
  }, [])

  return <div id="map" style={{ height: '100vh', width: '100%' }} />
}