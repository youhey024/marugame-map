'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const VISITED_KEY = 'visited_shops'

type VisitedData = Record<number, number> // id -> timestamp

function getVisited(): VisitedData {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(VISITED_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    // 旧形式（配列）の場合は変換
    if (Array.isArray(parsed)) {
      const converted: VisitedData = {}
      parsed.forEach((id: number) => { converted[id] = 0 })
      return converted
    }
    return parsed
  } catch { return {} }
}

function saveVisited(visited: VisitedData) {
  localStorage.setItem(VISITED_KEY, JSON.stringify(visited))
}

function isVisited(visited: VisitedData, id: number): boolean {
  return id in visited
}

function getVisitOrder(visited: VisitedData, id: number): number {
  const sorted = Object.entries(visited).sort((a, b) => a[1] - b[1])
  const index = sorted.findIndex(([key]) => Number(key) === id)
  return index + 1
}

const PHOTOS_KEY = 'shop_photos'

function getPhotos(): Record<number, string> {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(PHOTOS_KEY)
  return raw ? JSON.parse(raw) : {}
}

function savePhoto(shopId: number, base64: string) {
  const photos = getPhotos()
  photos[shopId] = base64
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos))
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxSize = 800
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width
        width = maxSize
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
  })
}

function createIcon(visited: boolean, order?: number) {
  if (visited && order) {
    return L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:25px;height:41px">
          <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" style="width:25px;height:41px" />
          <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#333;color:white;border-radius:10px;padding:1px 5px;font-size:11px;font-weight:bold;white-space:nowrap">${order}</div>
        </div>
      `,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    })
  }
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

function buildPopupHtml(shop: { id: number; name: string; address: string }, visited: VisitedData) {
  const photos = getPhotos()
  const photo = photos[shop.id]
  const isV = isVisited(visited, shop.id)
  const order = isV ? getVisitOrder(visited, shop.id) : null
  return `
    <div style="min-width:180px">
      <b>${shop.name}</b><br>
      <span style="font-size:0.85em">${shop.address}</span><br><br>
      ${photo ? `<img src="${photo}" style="width:100%;border-radius:6px;margin-bottom:4px" /><button id="delete-photo-${shop.id}" style="font-size:12px;padding:2px 8px;margin-bottom:8px;cursor:pointer;color:red;background:none;border:1px solid red;border-radius:4px;">写真を削除</button>` : ''}
      ${isV
        ? `<span style="color:green">✓ 訪問済み（${order}店舗目）</span>
           <br><button id="toggle-${shop.id}" style="margin-top:6px;padding:4px 10px;cursor:pointer">取り消す</button>`
        : `<button id="toggle-${shop.id}" style="margin-top:6px;padding:4px 10px;cursor:pointer">訪問済みにする</button>`
      }
      <br>
      <label for="photo-${shop.id}" style="display:inline-block;margin-top:6px;padding:4px 10px;background:#f0f0f0;border-radius:4px;cursor:pointer;font-size:13px">
        ${photo ? '📷 写真を変更' : '📷 写真を追加'}
      </label>
      <input id="photo-${shop.id}" type="file" accept="image/*" capture="environment" style="display:none" />
    </div>
  `
}

function deletePhoto(shopId: number) {
  const photos = getPhotos()
  delete photos[shopId]
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos))
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
        counter.style.cssText = 'background:rgba(255,255,255,0.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:8px 14px;border-radius:8px;font-size:14px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;color:#333;'
        counter.innerHTML = '読み込み中...'

        // パネル
        const panel = L.DomUtil.create('div', '', container)
        panel.id = 'visit-panel'
        panel.style.cssText = 'display:none;margin-top:6px;background:rgba(255,255,255,0.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.3);max-height:60vh;overflow-y:auto;'

        const panelHeader = L.DomUtil.create('div', '', panel)
        panelHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.1);'
        panelHeader.innerHTML = '<span style="font-weight:bold;font-size:14px;color:#333;">訪問済み店舗</span><span id="visit-panel-close" style="cursor:pointer;font-size:18px;color:#333;">✕</span>'
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
      el.innerHTML = `✓ ${Object.keys(visited).length} / 56 店舗訪問済み`
    }

    function updatePanel(shops: { id: number; name: string; lat: number; lng: number }[], markers: Record<number, L.Marker>) {
      const list = document.getElementById('visit-panel-list')
      if (!list) return
      const visited = getVisited()
      const visitedShops = shops.filter(s => isVisited(visited, s.id))
      if (visitedShops.length === 0) {
        list.innerHTML = '<p style="color:#666;font-size:14px;padding:10px 0;">まだ訪問した店舗はありません</p>'
        return
      }
      list.innerHTML = visitedShops.map(s => `
        <div id="panel-item-${s.id}" style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.1);cursor:pointer;font-size:14px;color:#333;">
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

          const marker = L.marker([shop.lat, shop.lng], {
            icon: createIcon(isVisited(visited, shop.id), isVisited(visited, shop.id) ? getVisitOrder(visited, shop.id) : undefined)
          })
            .addTo(map)
            .bindPopup(buildPopupHtml(shop, visited))

          marker.on('popupopen', () => {
            const btn = document.getElementById(`toggle-${shop.id}`)
            if (!btn) return
            btn.addEventListener('click', () => {
              const visited = getVisited()
              if (isVisited(visited, shop.id)) {
                delete visited[shop.id]
              } else {
                visited[shop.id] = Date.now()
              }
              saveVisited(visited)

              // 全マーカーのアイコンを更新（番号が変わるため）
              Object.entries(markers).forEach(([id, m]) => {
                const numId = Number(id)
                m.setIcon(createIcon(isVisited(visited, numId), isVisited(visited, numId) ? getVisitOrder(visited, numId) : undefined))
                m.setPopupContent(buildPopupHtml(shops.find((s: {id: number}) => s.id === numId)!, visited)) // 追加
              })

              marker.setPopupContent(buildPopupHtml(shop, visited))
              marker.openPopup()
              updateCounter()
              updatePanel(shops, markers)
            })

            // 写真アップロード
            const photoInput = document.getElementById(`photo-${shop.id}`) as HTMLInputElement
            if (photoInput) {
              photoInput.addEventListener('change', async () => {
                const file = photoInput.files?.[0]
                if (!file) return
                const base64 = await compressImage(file)
                savePhoto(shop.id, base64)
                marker.setPopupContent(buildPopupHtml(shop, getVisited()))
              })
            }

            const deleteBtn = document.getElementById(`delete-photo-${shop.id}`)
            if (deleteBtn) {
              deleteBtn.addEventListener('click', () => {
                deletePhoto(shop.id)
                marker.setPopupContent(buildPopupHtml(shop, getVisited()))
              })
            }
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