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

    // 現在地表示
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

    // カウンター
    const CounterControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div')
        container.style.cssText = 'max-width:280px'
        L.DomEvent.disableClickPropagation(container)

        // カウンター
        const counter = L.DomUtil.create('div', '', container)
        counter.id = 'visit-counter'
        counter.style.cssText = 'background:white;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;color:#333;'
        counter.innerHTML = '読み込み中...'

        // パネル
        const panel = L.DomUtil.create('div', '', container)
        panel.id = 'visit-panel'
        panel.style.cssText = 'display:none;margin-top:6px;background:white;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.3);max-height:60vh;overflow-y:auto;'

        const panelHeader = L.DomUtil.create('div', '', panel)
        panelHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #eee;'
        panelHeader.innerHTML = '<span style="font-weight:bold;font-size:14px">訪問済み店舗</span><span id="visit-panel-close" style="cursor:pointer;font-size:18px">✕</span>'

        const list = L.DomUtil.create('div', '', panel)
        list.id = 'visit-panel-list'
        list.style.cssText = 'padding:0 14px;'

        counter.addEventListener('click', () => {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
        })

        return container
      }
    })
    new CounterControl({ position: 'topleft' }).addTo(map)

    function updateCounter() {
      const el = document.getElementById('visit-counter')
      if (!el) return
      const visited = getVisited()
      el.innerHTML = `✓ ${visited.size} / 56 店舗訪問済み`
    }

    function updatePanel(shops: { id: number; name: string; lat: number; lng: number }[], markers: Record<number, L.Marker>) {
      const list = document.getElementById('visit-panel-list')
      if (!list) return
      const visited = getVisited()
      const visitedShops = shops.filter(s => visited.has(s.id))
      if (visitedShops.length === 0) {
        list.innerHTML = '<p style="color:#888;font-size:14px">まだ訪問した店舗はありません</p>'
        return
      }
      list.innerHTML = visitedShops.map(s => `
        <div id="panel-item-${s.id}" style="padding:10px 0;border-bottom:1px solid #eee;cursor:pointer;font-size:14px">
          🍜 ${s.name}
        </div>
      `).join('')

      visitedShops.forEach(s => {
        const el = document.getElementById(`panel-item-${s.id}`)
        if (!el) return
        el.addEventListener('click', () => {
          map.setView([s.lat, s.lng], 15)
          markers[s.id]?.openPopup()
        })
      })
      document.getElementById('visit-panel-close')?.addEventListener('click', (e) => {
        e.stopPropagation()
        const panel = document.getElementById('visit-panel')
        if (panel) panel.style.display = 'none'
      })
    }

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
              updateCounter()
              updatePanel(shops, markers)
            })
          })

          markers[shop.id] = marker
        })

        updateCounter()
        updatePanel(shops, markers)
      })

    return () => {
      isMounted = false
      map.remove()
    }
  }, [])

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div id="map" style={{ height: '100%', width: '100%' }} />
    </div>
  )
}