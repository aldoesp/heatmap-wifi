import { useState, useEffect, useRef } from 'react'
import { Wifi, Map as MapIcon, Signal, Download, Trash2, X, Plus } from 'lucide-react'
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
  
  const canvasRef = useRef(null)
  const bgInputRef = useRef(null)

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

  const getNetworks = () => {
    const set = new Set()
    points.forEach(p => (p.scans || []).forEach(s => set.add(s.ssid || '(caché)')))
    return Array.from(set).sort()
  }

  const networks = getNetworks()

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

      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = '#c8f0c8'
      const label = v === null ? 'n/a' : `${v}dBm`
      ctx.fillText(label, p.x + 9, p.y + 3)
    })
  }, [points, network, bgImage])

  // Handle canvas click
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
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
      if (!response.ok) {
        throw new Error('Erreur HTTP: ' + response.status)
      }
      const data = await response.json()
      setScanInput(JSON.stringify(data, null, 2))
    } catch (err) {
      setScanError(err.message)
      alert('Erreur du scan: ' + err.message)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <div className="text-[var(--accent)] font-bold flex items-center gap-2">
          rssi-heatmap <span className="animate-pulse">_</span>
          <span className="border border-[var(--border)] text-[var(--muted)] px-1.5 py-0.5 rounded text-[10px]">prototype React</span>
        </div>
        <div className="text-[var(--muted)] text-[11px]">clic sur le plan = nouveau point de mesure</div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-[calc(100vh-46px)]">
        {/* Sidebar */}
        <div className="w-[290px] flex-shrink-0 border-r border-[var(--border)] p-3.5 flex flex-col gap-4 overflow-y-auto">
          
          {/* Background image upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--muted)] text-[11px] tracking-wide">PLAN DE FOND (optionnel)</label>
            <input 
              type="file" 
              ref={bgInputRef}
              onChange={handleBgUpload}
              accept="image/*"
              className="bg-[#050705] border border-[var(--border)] text-[var(--text)] text-[12px] py-1.5 px-2 rounded"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleClearBg}
                className="flex-1 border border-[var(--muted)] text-[var(--text)] py-1.5 px-2 text-[12px] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                retirer image
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--border)] my-0.5"></div>

          {/* Network selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--muted)] text-[11px] tracking-wide">RÉSEAU AFFICHÉ</label>
            <select 
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="bg-[#050705] border border-[var(--border)] text-[var(--text)] text-[12px] py-1.5 px-2 rounded focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="__best__">meilleur signal (tous réseaux)</option>
              {networks.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <p className="text-[var(--muted)] text-[11px] leading-relaxed">
              "meilleur signal" = combine tous les réseaux détectés, utile pour une couverture globale.
            </p>
          </div>

          <div className="border-t border-[var(--border)] my-0.5"></div>

          {/* Points list */}
          <div>
            <div className="text-[var(--accent)] text-[11px] tracking-wide mb-2">
              POINTS DE MESURE ({points.length})
            </div>
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto text-[11px]">
              {points.map(p => {
                const v = bestRssiForNetwork(p, network)
                return (
                  <div 
                    key={p.id}
                    className="flex justify-between items-center border border-[var(--border)] p-1.5 rounded"
                  >
                    <span>
                      #{p.id} ({Math.round(p.x)},{Math.round(p.y)}){' '}
                      <span className="text-[var(--accent)]">{v === null ? 'n/a' : v + 'dBm'}</span>
                    </span>
                    <button 
                      onClick={() => handleDeletePoint(p.id)}
                      className="px-1.5 py-0.5 text-[11px] border border-[var(--border)] hover:border-[var(--warn)] hover:text-[var(--warn)] transition-colors"
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
              className="flex-1 border border-[var(--muted)] text-[var(--text)] py-1.5 px-2 text-[12px] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-1"
            >
              <Download size={12} /> exporter JSON
            </button>
            <button 
              onClick={handleClearAll}
              className="border border-[var(--warn)] text-[var(--warn)] py-1.5 px-2 text-[12px] hover:bg-[var(--warn)] hover:text-[#04150a] transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 size={12} /> tout effacer
            </button>
          </div>

          <div className="border-t border-[var(--border)] my-0.5"></div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <span>-90 dBm</span>
            <div className="flex-1 h-2.5 rounded bg-gradient-to-r from-[#ff5555] via-[#ffd166] to-[#39ff88]"></div>
            <span>-30 dBm</span>
          </div>

          <p className="text-[var(--muted)] text-[11px] leading-relaxed">
            Sans lecture pour le réseau choisi, un point est traité comme signal absent (-95 dBm) dans l'interpolation — ça tire le heatmap vers le rouge autour des zones non couvertes.
          </p>
        </div>

        {/* Canvas stage */}
        <div className="flex-1 flex items-center justify-center p-5 overflow-auto">
          <div id="canvasWrap" className="relative border border-[var(--border)] bg-[#060906]" 
               style={{
                 backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, var(--border) 1px, transparent 1px) 0 0/40px 40px`
               }}>
            <canvas 
              ref={canvasRef}
              width="820" 
              height="560" 
              onClick={handleCanvasClick}
              className="block cursor-crosshair"
            ></canvas>
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="bg-[var(--panel)] border border-[var(--accent)] w-[min(560px,92vw)] p-4 rounded flex flex-col gap-2.5">
            <h3 className="text-[13px] text-[var(--accent)] m-0">nouveau point de mesure</h3>
            <p className="text-[var(--muted)] text-[11px] leading-relaxed">
              Colle ici le JSON de scan (sortie <code>termux-wifi-scaninfo</code>) pris à cet endroit.
            </p>
            <textarea 
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder='[{"bssid":"...","ssid":"...","rssi":-55,...}]'
              className="h-[220px] text-[11px] resize-vertical bg-[#050705] border border-[var(--border)] text-[var(--text)] p-2 rounded focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex justify-between items-center gap-2">
              <button 
                onClick={handleScan}
                disabled={isScanning}
                className={`border border-[var(--accent)] text-[var(--accent)] py-1.5 px-2 text-[12px] transition-colors flex items-center gap-1 ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--accent)] hover:text-[#04150a]'}`}
              >
                {isScanning ? 'Scan en cours...' : 'Scanner'}
              </button>
              <button 
                onClick={handleFillExample}
                className="border border-[var(--muted)] text-[var(--text)] py-1.5 px-2 text-[12px] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                charger exemple (ton scan Zomatel)
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={handleCancelPoint}
                  className="border border-[var(--border)] text-[var(--text)] py-1.5 px-2 text-[12px] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  annuler
                </button>
                <button 
                  onClick={handleConfirmPoint}
                  className="border border-[var(--accent)] text-[var(--accent)] py-1.5 px-2 text-[12px] hover:bg-[var(--accent)] hover:text-[#04150a] transition-colors"
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