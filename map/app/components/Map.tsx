'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const VISITED_KEY = 'visited_shops'

function getVisited(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  const raw = localStorage.getItem(VISITED_KEY)
  return raw ? new Set(JSON.parse(raw)) : new Set()
}

function saveVisited(visited: Set<number>) {
  localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]))
}

function createIcon(visited: boolean) {
  return L.icon({
    iconUrl: visited
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
      : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: visited
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
      : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

function buildPopupHtml(shop: { id: number; name: string; address: string }, visited: boolean) {
  return `
    <div style="min-width:160px">
      <b>${shop.name}</b><br>
      <span style="font-size:0.85em">${shop.address}</span><br><br>
      ${visited
        ? `<span style="color:green">✓ 訪問済み</span>
           <br><button id="toggle-${shop.id}" style="margin-top:6px;padding:4px 10px;cursor:pointer">取り消す</button>`
        : `<button id="toggle-${shop.id}" style="margin-top:6px;padding:4px 10px;cursor:pointer">訪問済みにする</button>`
      }
    </div>
  `
}

export default function Map() {
  useEffect(() => {
    const map = L.map('map').setView([35.9, 139.6], 11)
    let isMounted = true

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    map.locate({ watch: true, setView: false })
    map.on('locationfound', (e) => {
      L.circle(e.latlng, { radius: e.accuracy / 2 }).addTo(map)
      L.marker(e.latlng, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;background:blue;border:2px solid white;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
      }).addTo(map).bindPopup('現在地')
    })

    fetch('/shops.json')
      .then(res => res.json())
      .then(shops => {
        if (!isMounted) return
        const visited = getVisited()
        const markers: Record<number, L.Marker> = {}

        shops.forEach((shop: { id: number; name: string; address: string; lat: number; lng: number }) => {
          if (!shop.lat || !shop.lng) return

          const marker = L.marker([shop.lat, shop.lng], { icon: createIcon(visited.has(shop.id)) })
            .addTo(map)
            .bindPopup(buildPopupHtml(shop, visited.has(shop.id)))

          marker.on('popupopen', () => {
            const btn = document.getElementById(`toggle-${shop.id}`)
            if (!btn) return
            btn.addEventListener('click', () => {
              const visited = getVisited()
              if (visited.has(shop.id)) {
                visited.delete(shop.id)
              } else {
                visited.add(shop.id)
              }
              saveVisited(visited)
              marker.setIcon(createIcon(visited.has(shop.id)))
              marker.setPopupContent(buildPopupHtml(shop, visited.has(shop.id)))
            })
          })

          markers[shop.id] = marker
        })
      })

    return () => {
      isMounted = false
      map.remove()
    }
  }, [])

  return <div id="map" style={{ height: '100vh', width: '100%' }} />
}