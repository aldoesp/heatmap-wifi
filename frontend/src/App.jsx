import { useState, useEffect, useRef } from 'react'
import { Wifi, Map as MapIcon, Signal, Download, Trash2, X, Plus } from 'lucide-react'
import { distancePixelsBetween, pixelsPerMeterFromDistance, pixelsToMeters } from './scale'
import { parseJsonResponse, normalizeScanData } from './scan'
import './App.css'

// Example scan data from Zomatel
const EXAMPLE_SCAN = [
  {"bssid":"9a:30:66:74:50:83","frequency_mhz":5200,"rssi":-40,"ssid":"ZMTL_GUEST"},
  {"bssid":"8c:30:66:74:50:83","frequency_mhz":5200,"rssi":-40,"ssid":"WF_ZOMATEL"},
  {"bssid":"1c:0b:8b:0c:cb:60","frequency_mhz":5640,"rssi":-76,"ssid":"WF_ZOMATEL"},
  {"bssid":"22:0b:8b:0c:cb:60","frequency_mhz":5640,"rssi":-76,"ssid":"ZMTL_BOX"},
  {"bssid":"26:0b:8b:0c:cb:60","frequency_mhz":5640,"rssi":-76,"ssid":""},
  {"bssid":"2a:0b:8b:0c:cb:60","frequency_mhz":5640,"rssi":-76,"ssid":"ZMTL_GUEST"},
  {"bssid":"2a:0b:8b:0c:cb:5f","frequency_mhz":2412,"rssi":-76,"ssid":"ZMTL_GUEST"},
  {"bssid":"1c:0b:8b:0c:cb:5f","frequency_mhz":2412,"rssi":-77,"ssid":"WF_ZOMATEL"},
  {"bssid":"8c:30:66:74:51:d8","frequency_mhz":2462,"rssi":-84,"ssid":"WF_ZOMATEL"},
  {"bssid":"8c:30:66:74:51:d7","frequency_mhz":5240,"rssi":-84,"ssid":"WF_ZOMATEL"},
  {"bssid":"9a:30:66:74:51:d7","frequency_mhz":5240,"rssi":-84,"ssid":"ZMTL_GUEST"},
  {"bssid":"92:30:66:74:51:d7","frequency_mhz":5240,"rssi":-85,"ssid":"ZMTL_BOX"},
  {"bssid":"96:30:66:74:51:d7","frequency_mhz":5240,"rssi":-85,"ssid":""}
];

function App() {
  const [points, setPoints] = useState([])
  const [nextId, setNextId] = useState(1)
  const [network, setNetwork] = useState('__best__')
  const [bgImage, setBgImage] = useState(null)
  const [pendingPoint, setPendingPoint] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [pixelsPerMeter, setPixelsPerMeter] = useState(0)
  const [scaleDistanceInput, setScaleDistanceInput] = useState(5)
  const [calibrationMode, setCalibrationMode] = useState(false)
  const [calibrationPoints, setCalibrationPoints] = useState([])
  const [calibrationReference, setCalibrationReference] = useState(null)
  const [calibrationError, setCalibrationError] = useState('')
  
  const canvasRef = useRef(null)
  const bgInputRef = useRef(null)
  const calibrationInputRef = useRef(null)

  // Utility functions
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  const rssiToColor = (rssi) => {
    const t = clamp((rssi + 90) / 60, 0, 1)
    const hue = t * 120
    return `hsl(${hue}, 85%, 45%)`
  }

  const rssiToColorRGB = (rssi) => {
    const t = clamp((rssi + 90) / 60, 0, 1)
    const hue = t * 120
    return hslToRgb(hue / 360, 0.85, 0.4)
  }

  const hslToRgb = (h, s, l) => {
    let r, g, b
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }

  const bestRssiForNetwork = (point, selectedNetwork) => {
    if (!point.scans || point.scans.length === 0) return null
    if (selectedNetwork === '__best__') {
      return Math.max(...point.scans.map(s => s.rssi))
    }
    const matches = point.scans.filter(s => (s.ssid || '(caché)') === selectedNetwork)
    if (matches.length === 0) return null
    return Math.max(...matches.map(s => s.rssi))
  }

  const formatMeters = (value) => {
    if (!Number.isFinite(value)) return 'n/a'
    return `${value.toFixed(1)} m`
  }

  const getPointRealPosition = (point) => {
    if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null
    return {
      x: pixelsToMeters(point.x, pixelsPerMeter),
      y: pixelsToMeters(point.y, pixelsPerMeter),
    }
  }

  const getNetworks = () => {
    const set = new Set()
    points.forEach(p => (p.scans || []).forEach(s => set.add(s.ssid || '(caché)')))
    return Array.from(set).sort()
  }

  const networks = getNetworks()

  const applyCalibration = (startPoint, endPoint) => {
    const meters = Number(scaleDistanceInput)
    if (!Number.isFinite(meters) || meters <= 0) {
      setCalibrationError('Saisis une distance réelle valide en mètres pour calibrer l’échelle.')
      return
    }

    const pixels = distancePixelsBetween(startPoint, endPoint)
    const nextPixelsPerMeter = pixelsPerMeterFromDistance(pixels, meters)

    if (!Number.isFinite(nextPixelsPerMeter) || nextPixelsPerMeter <= 0) {
      setCalibrationError('La distance mesurée est trop courte pour calibrer l’échelle.')
      return
    }

    setPixelsPerMeter(nextPixelsPerMeter)
    setCalibrationMode(false)
    setCalibrationPoints([])
    setCalibrationError('')
  }

  const resetCalibration = () => {
    setPixelsPerMeter(0)
    setCalibrationMode(false)
    setCalibrationPoints([])
    setCalibrationReference(null)
    setCalibrationError('')
  }

  const exportCalibration = () => {
    const payload = {
      version: 1,
      pixelsPerMeter,
      distanceMeters: Number(scaleDistanceInput),
      calibrationReference,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wifi-calibration.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importCalibration = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const nextPixelsPerMeter = Number(data.pixelsPerMeter)
        const nextDistanceMeters = Number(data.distanceMeters ?? data.scaleDistanceInput ?? scaleDistanceInput)

        if (!Number.isFinite(nextPixelsPerMeter) || nextPixelsPerMeter <= 0) {
          throw new Error('Le fichier de calibration ne contient pas un ratio px/m valide.')
        }

        if (!Number.isFinite(nextDistanceMeters) || nextDistanceMeters <= 0) {
          throw new Error('Le fichier de calibration ne contient pas une distance réelle valide.')
        }

        setPixelsPerMeter(nextPixelsPerMeter)
        setScaleDistanceInput(nextDistanceMeters)
        setCalibrationReference(data.calibrationReference || null)
        setCalibrationMode(false)
        setCalibrationPoints([])
        setCalibrationError('')
      } catch (err) {
        setCalibrationError(err.message || 'Fichier de calibration invalide.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background image if present
    if (bgImage) {
      ctx.globalAlpha = 0.55
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
    }

    // Draw heatmap
    if (points.length > 0) {
      const step = 8
      const power = 2
      const pts = points.map(p => {
        const v = bestRssiForNetwork(p, network)
        return { x: p.x, y: p.y, v: v === null ? -95 : v }
      })

      const imgData = ctx.createImageData(canvas.width, canvas.height)

      for (let gy = 0; gy < canvas.height; gy += step) {
        for (let gx = 0; gx < canvas.width; gx += step) {
          let num = 0, den = 0, exact = null
          for (const p of pts) {
            const dx = gx - p.x, dy = gy - p.y
            const d2 = dx * dx + dy * dy
            if (d2 < 1) {
              exact = p.v
              break
            }
            const w = 1 / Math.pow(d2, power / 2)
            num += w * p.v
            den += w
          }
          const val = exact !== null ? exact : (num / den)
          const color = rssiToColorRGB(val)
          for (let oy = 0; oy < step; oy++) {
            for (let ox = 0; ox < step; ox++) {
              const px = gx + ox, py = gy + oy
              if (px >= canvas.width || py >= canvas.height) continue
              const idx = (py * canvas.width + px) * 4
              imgData.data[idx] = color[0]
              imgData.data[idx + 1] = color[1]
              imgData.data[idx + 2] = color[2]
              imgData.data[idx + 3] = 150
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }

    const activeCalibration = calibrationReference || (calibrationMode && calibrationPoints.length === 2
      ? { start: calibrationPoints[0], end: calibrationPoints[1], distanceMeters: Number(scaleDistanceInput), pixelsPerMeter: pixelsPerMeter > 0 ? pixelsPerMeter : pixelsPerMeterFromDistance(distancePixelsBetween(calibrationPoints[0], calibrationPoints[1]), Number(scaleDistanceInput)) }
      : null)

    if (calibrationMode && calibrationPoints.length > 0) {
      const point = calibrationPoints[calibrationPoints.length - 1]
      ctx.beginPath()
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd166'
      ctx.fill()
      ctx.strokeStyle = '#ffd166'
      ctx.stroke()
    }

    if (activeCalibration) {
      const { start, end, distanceMeters } = activeCalibration
      const pxDistance = distancePixelsBetween(start, end)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 8])
      ctx.stroke()
      ctx.setLineDash([])

      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      const label = `${distanceMeters.toFixed(1)} m · ${pixelsPerMeter > 0 ? pixelsPerMeter.toFixed(2) : (pxDistance / Math.max(distanceMeters, 0.1)).toFixed(2)} px/m`
      ctx.font = '11px JetBrains Mono, monospace'
      ctx.fillStyle = '#ffd166'
      ctx.fillText(label, centerX + 10, centerY - 10)
    }

    // Draw points
    points.forEach(p => {
      const v = bestRssiForNetwork(p, network)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#04150a'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = v === null ? '#666' : rssiToColor(v)
      ctx.stroke()

      const realPos = getPointRealPosition(p)
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = '#c8f0c8'
      const label = v === null ? 'n/a' : `${v}dBm`
      const textX = p.x + 9
      const textY = p.y + 3
      ctx.fillText(label, textX, textY)

      if (realPos) {
        ctx.fillStyle = '#9fe7ff'
        ctx.fillText(`(${formatMeters(realPos.x)},${formatMeters(realPos.y)})`, p.x + 9, p.y + 16)
      }
    })
  }, [points, network, bgImage, calibrationMode, calibrationPoints, calibrationReference, pixelsPerMeter, scaleDistanceInput])

  // Handle canvas click
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (calibrationMode) {
      const nextPoint = { x, y }
      const nextPoints = [...calibrationPoints, nextPoint]
      setCalibrationPoints(nextPoints)

      if (nextPoints.length === 2) {
        const nextReference = {
          start: nextPoints[0],
          end: nextPoints[1],
          distanceMeters: Number(scaleDistanceInput),
        }
        setCalibrationReference(nextReference)
        applyCalibration(nextPoints[0], nextPoints[1])
      }
      return
    }

    setPendingPoint({ x, y })
    setScanInput('')
    setIsModalOpen(true)
  }

  // Handle fill example
  const handleFillExample = () => {
    setScanInput(JSON.stringify(EXAMPLE_SCAN, null, 2))
  }

  // Handle cancel point
  const handleCancelPoint = () => {
    setIsModalOpen(false)
    setPendingPoint(null)
  }

  // Handle confirm point
  const handleConfirmPoint = () => {
    if (!pendingPoint) return
    let scans
    try {
      scans = JSON.parse(scanInput)
      if (!Array.isArray(scans)) throw new Error('pas un tableau')
    } catch (err) {
      alert('JSON invalide : ' + err.message)
      return
    }
    setPoints([...points, {
      id: nextId,
      x: pendingPoint.x,
      y: pendingPoint.y,
      scans
    }])
    setNextId(nextId + 1)
    setIsModalOpen(false)
    setPendingPoint(null)
  }

  // Handle delete point
  const handleDeletePoint = (id) => {
    setPoints(points.filter(p => p.id !== id))
  }

  // Handle export
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(points, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rssi-points.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle clear all
  const handleClearAll = () => {
    if (!confirm('Effacer tous les points ?')) return
    setPoints([])
  }

  // Handle background image upload
  const handleBgUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => setBgImage(img)
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  // Handle background clear
  const handleClearBg = () => {
    setBgImage(null)
  }

  // Handle scan button click
  const handleScan = async () => {
    setIsScanning(true)
    setScanError(null)
    try {
      const response = await fetch('/api/scan')
      const text = await response.text()

      if (!response.ok) {
        const payload = parseJsonResponse(text, 'Erreur HTTP du scan')
        const normalized = normalizeScanData(payload)
        if (normalized.length === 0 && payload && typeof payload === 'object' && payload.details) {
          throw new Error(payload.details)
        }
        throw new Error('Erreur HTTP: ' + response.status)
      }

      const payload = parseJsonResponse(text, 'Réponse de scan invalide')
      const normalized = normalizeScanData(payload)
      setScanInput(JSON.stringify(normalized, null, 2))
    } catch (err) {
      const message = err?.message || 'Erreur inconnue lors du scan.'
      setScanError(message)
      alert('Erreur du scan: ' + message)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <div className="px-4 py-2.5 border-b border-(--border) flex items-center justify-between flex-wrap gap-2">
        <div className="text-(--accent) font-bold flex items-center gap-2">
          rssi-heatmap <span className="animate-pulse">_</span>
          <span className="border border-(--border) text-(--muted) px-1.5 py-0.5 rounded text-[10px]">prototype React</span>
        </div>
        <div className="text-(--muted) text-[11px]">clic sur le plan = nouveau point de mesure</div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-[calc(100vh-46px)] flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-72.5 shrink-0 border-b md:border-b-0 md:border-r border-(--border) p-3.5 flex flex-col gap-4 overflow-y-auto">
          
          {/* Background image upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-(--muted) text-[11px] tracking-wide">PLAN DE FOND (optionnel)</label>
            <input 
              type="file" 
              ref={bgInputRef}
              onChange={handleBgUpload}
              accept="image/*"
              className="bg-[#050705] border border-(--border) text-(--text) text-[12px] py-1.5 px-2 rounded"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleClearBg}
                className="flex-1 border border-(--muted) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                retirer image
              </button>
            </div>
          </div>

          <div className="border-t border-(--border) my-0.5"></div>

          {/* Scale calibration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-(--muted) text-[11px] tracking-wide">CALIBRATION D’ÉCHELLE</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={scaleDistanceInput}
                onChange={(e) => setScaleDistanceInput(Number(e.target.value))}
                className="flex-1 bg-[#050705] border border-(--border) text-(--text) text-[12px] py-1.5 px-2 rounded"
              />
              <span className="text-(--muted) text-[11px] self-center">m</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCalibrationError('')
                  setCalibrationPoints([])
                  setCalibrationMode(true)
                }}
                className="flex-1 border border-(--accent) text-(--accent) py-1.5 px-2 text-[12px] hover:bg-(--accent) hover:text-[#04150a] transition-colors"
              >
                mesurer l’échelle
              </button>
              <button
                onClick={resetCalibration}
                className="border border-(--border) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                reset
              </button>
            </div>
            {pixelsPerMeter > 0 ? (
              <p className="text-(--accent) text-[11px] leading-relaxed">
                Échelle active : {pixelsPerMeter.toFixed(2)} px/m
              </p>
            ) : (
              <p className="text-(--muted) text-[11px] leading-relaxed">
                Cliquez deux points sur le plan pour définir une distance réelle.
              </p>
            )}
            {calibrationMode && (
              <p className="text-(--mid) text-[11px] leading-relaxed">
                Étape {calibrationPoints.length + 1}/2 : cliquez sur le premier point.
              </p>
            )}
            {calibrationReference && (
              <p className="text-(--muted) text-[11px] leading-relaxed">
                Guide actif : {Number(scaleDistanceInput).toFixed(1)} m sur la carte
              </p>
            )}
            {calibrationError && (
              <p className="text-(--warn) text-[11px] leading-relaxed">{calibrationError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={exportCalibration}
                className="flex-1 border border-(--muted) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                exporter
              </button>
              <button
                onClick={() => calibrationInputRef.current?.click()}
                className="flex-1 border border-(--muted) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                importer
              </button>
            </div>
            <input
              ref={calibrationInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={importCalibration}
            />
          </div>

          <div className="border-t border-(--border) my-0.5"></div>

          {/* Network selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-(--muted) text-[11px] tracking-wide">RÉSEAU AFFICHÉ</label>
            <select 
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="bg-[#050705] border border-(--border) text-(--text) text-[12px] py-1.5 px-2 rounded focus:outline-none focus:border-(--accent)"
            >
              <option value="__best__">meilleur signal (tous réseaux)</option>
              {networks.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <p className="text-(--muted) text-[11px] leading-relaxed">
              "meilleur signal" = combine tous les réseaux détectés, utile pour une couverture globale.
            </p>
          </div>

          <div className="border-t border-(--border) my-0.5"></div>

          {/* Points list */}
          <div>
            <div className="text-(--accent) text-[11px] tracking-wide mb-2">
              POINTS DE MESURE ({points.length})
            </div>
            <div className="flex flex-col gap-1.5 max-h-55 overflow-y-auto text-[11px]">
              {points.map(p => {
                const v = bestRssiForNetwork(p, network)
                return (
                  <div 
                    key={p.id}
                    className="flex justify-between items-center border border-(--border) p-1.5 rounded"
                  >
                    <span>
                      #{p.id} {pixelsPerMeter > 0 ? `(${formatMeters(getPointRealPosition(p)?.x ?? 0)},${formatMeters(getPointRealPosition(p)?.y ?? 0)})` : `(${Math.round(p.x)},{Math.round(p.y)})`}{' '}
                      <span className="text-(--accent)">{v === null ? 'n/a' : v + 'dBm'}</span>
                    </span>
                    <button 
                      onClick={() => handleDeletePoint(p.id)}
                      className="px-1.5 py-0.5 text-[11px] border border-(--border) hover:border-(--warn) hover:text-(--warn) transition-colors"
                    >
                      x
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="flex-1 border border-(--muted) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors flex items-center justify-center gap-1"
            >
              <Download size={12} /> exporter JSON
            </button>
            <button 
              onClick={handleClearAll}
              className="border border-(--warn) text-(--warn) py-1.5 px-2 text-[12px] hover:bg-(--warn) hover:text-[#04150a] transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 size={12} /> tout effacer
            </button>
          </div>

          <div className="border-t border-(--border) my-0.5"></div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[11px] text-(--muted)">
            <span>-90 dBm</span>
            <div className="flex-1 h-2.5 rounded bg-linear-to-r from-[#ff5555] via-[#ffd166] to-[#39ff88]"></div>
            <span>-30 dBm</span>
          </div>

          <p className="text-(--muted) text-[11px] leading-relaxed">
            Sans lecture pour le réseau choisi, un point est traité comme signal absent (-95 dBm) dans l'interpolation — ça tire le heatmap vers le rouge autour des zones non couvertes.
          </p>
        </div>

        {/* Canvas stage */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5 overflow-auto">
          <div id="canvasWrap" className="relative border border-(--border) bg-[#060906] w-full max-w-205"
               style={{
                 backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, var(--border) 1px, transparent 1px) 0 0/40px 40px`
               }}>
            <canvas 
              ref={canvasRef}
              width="820" 
              height="560" 
              onClick={handleCanvasClick}
              className="block cursor-crosshair w-full h-auto max-w-full"
            ></canvas>
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="bg-(--panel) border border-(--accent) w-[min(560px,92vw)] p-4 rounded flex flex-col gap-2.5">
            <h3 className="text-[13px] text-(--accent) m-0">nouveau point de mesure</h3>
            <p className="text-(--muted) text-[11px] leading-relaxed">
              Colle ici le JSON de scan (sortie <code>termux-wifi-scaninfo</code>) pris à cet endroit.
            </p>
            <textarea 
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder='[{"bssid":"...","ssid":"...","rssi":-55,...}]'
              className="h-55 text-[11px] resize-vertical bg-[#050705] border border-(--border) text-(--text) p-2 rounded focus:outline-none focus:border-(--accent)"
            />
            <div className="flex justify-between items-center gap-2">
              <button 
                onClick={handleScan}
                disabled={isScanning}
                className={`border border-(--accent) text-(--accent) py-1.5 px-2 text-[12px] transition-colors flex items-center gap-1 ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-(--accent) hover:text-[#04150a]'}`}
              >
                {isScanning ? 'Scan en cours...' : 'Scanner'}
              </button>
              <button 
                onClick={handleFillExample}
                className="border border-(--muted) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
              >
                charger exemple (ton scan Zomatel)
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={handleCancelPoint}
                  className="border border-(--border) text-(--text) py-1.5 px-2 text-[12px] hover:border-(--accent) hover:text-(--accent) transition-colors"
                >
                  annuler
                </button>
                <button 
                  onClick={handleConfirmPoint}
                  className="border border-(--accent) text-(--accent) py-1.5 px-2 text-[12px] hover:bg-(--accent) hover:text-[#04150a] transition-colors"
                >
                  ajouter le point
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App