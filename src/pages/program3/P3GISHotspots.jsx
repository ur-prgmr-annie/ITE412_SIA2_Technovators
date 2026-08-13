// src/pages/program3/P3GISHotspots.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import "../../styles/p3GIS.css";
import {
  MapPinned,
  Layers,
  Search,
  X,
  Filter,
  Activity,
  Printer,
  RefreshCw,
  AlertTriangle,
  Home,
  FileText,
  Download,
  CheckCircle2,
  Thermometer,
  Droplet,
  AlertOctagon,
  ChevronUp,    // ✅ ADDED
  ChevronDown,  // ✅ ADDED
} from "lucide-react";

import { auth, db } from "../../services/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";

// Leaflet
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

// Export libs
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ========== CONSTANTS ==========
const DEFAULT_PROVINCE = "Oriental Mindoro";
const DEFAULT_MUNICIPALITY = "Naujan";
const NAUJAN_CENTER = [13.3236, 121.3027];

// Barangay coordinates
const BARANGAY_COORDINATES = {
  "Poblacion I": [13.3236, 121.3027],
  "Poblacion II": [13.3245, 121.3035],
  "Poblacion III": [13.3228, 121.3019],
  "San Jose": [13.315, 121.295],
  "Bagong Buhay": [13.33, 121.31],
  "Sampaguita": [13.34, 121.315],
  "Wawa": [13.35, 121.32],
  "Barcenaga": [13.305, 121.295],
  "San Andres": [13.735, 121.725],
  "Bacungan": [13.285, 121.275],
  "Bancuro": [13.295, 121.285],
  "Mahabang Parang": [13.335, 121.32],
  "Malaya": [13.345, 121.325],
  "Montelago": [13.355, 121.335],
  "Pinagsabangan": [13.365, 121.345],
  "San Antonio": [13.375, 121.355],
  "San Isidro": [13.385, 121.365],
  "Santa Cruz": [13.395, 121.375],
  "Santa Maria": [13.405, 121.385],
  Santiago: [13.415, 121.395],
  "Santo Niño": [13.425, 121.405],
};

const BARANGAYS = Object.keys(BARANGAY_COORDINATES);
const DEFAULT_COORDS = NAUJAN_CENTER;

// Export formats
const EXPORT_FORMATS = [
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF Report" },
  { value: "json", label: "JSON (Backup)" },
];

// ========== HELPERS ==========
function formatNumber(num) {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat().format(num);
}

function formatDate(date) {
  if (!date) return "—";
  try {
    if (date?.toDate) date = date.toDate();
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(date) {
  if (!date) return "—";
  try {
    if (date?.toDate) date = date.toDate();
    return new Date(date).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getHeatmapColor(value, max) {
  if (!max || max === 0) return "#e5e7eb";
  const ratio = value / max;
  if (ratio < 0.25) return "#93c5fd";
  if (ratio < 0.5) return "#3b82f6";
  if (ratio < 0.75) return "#f97316";
  return "#ef4444";
}

function getBarangayCoordinates(barangay) {
  return BARANGAY_COORDINATES[barangay] || DEFAULT_COORDS;
}

function toMillis(d) {
  if (!d) return 0;
  if (d?.toDate) return d.toDate().getTime();
  if (d instanceof Date) return d.getTime();
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

// ========== EXPORT MODAL ==========
function ExportModal({ open, onClose, onExport }) {
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [includeDetails, setIncludeDetails] = useState({
    summary: true,
    barangays: true,
    cases: true,
    hotspots: true,
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport({
        format: exportFormat,
        dateRange,
        includeDetails,
      });
      onClose();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p1m-wrap" role="dialog" aria-modal="true">
      <div className="p1m-overlay" onClick={onClose} />
      <div className="p1m-card p1m-export">
        <div className="p1m2-head">
          <div>
            <div className="p1m2-title">Export GIS Data</div>
            <div className="p1m2-sub">
              Download GIS report with case hotspots and disease surveillance data
            </div>
          </div>
          <button className="p1m2-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="p1m2-body">
          <div className="p1m2-card">
            <div className="p1m2-fields">
              <div className="p1m2-row">
                <label>Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                >
                  {EXPORT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p1m2-2">
                <div className="p1m2-row">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((d) => ({ ...d, start: e.target.value }))
                    }
                  />
                </div>
                <div className="p1m2-row">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((d) => ({ ...d, end: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="p1m2-row">
                <label>Include in Export</label>
                <div className="p1m2-checkbox-group">
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.summary}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          summary: e.target.checked,
                        }))
                      }
                    />
                    <span>Summary Report</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.barangays}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          barangays: e.target.checked,
                        }))
                      }
                    />
                    <span>Barangay Coverage</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.cases}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          cases: e.target.checked,
                        }))
                      }
                    />
                    <span>Case Reports</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.hotspots}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          hotspots: e.target.checked,
                        }))
                      }
                    />
                    <span>Hotspot Analysis</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p1m2-foot">
          <div className="p1m2-footNote">
            <FileText size={16} />
            <span>Data will be exported based on selected options</span>
          </div>
          <div className="p1m2-actions">
            <button
              className="p1m2-btn ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="p1m2-btn" onClick={handleExport} disabled={busy}>
              {busy ? "Exporting..." : "Export Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MAP COMPONENT ==========
function MapComponent({
  center,
  zoom,
  markers,
  heatmapData,
  layer,
  onMarkerClick,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView(center, zoom);

    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(center, zoom, { animate: true });
  }, [center, zoom]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const isHeat = layer !== "markers";

    if (isHeat) {
      if (heatmapData?.length) {
        const pts = heatmapData.map((p) => [p.lat, p.lng, p.intensity]);
        heatLayerRef.current = L.heatLayer(pts, {
          radius: 25,
          blur: 15,
          maxZoom: 12,
          gradient: {
            0.2: "#93c5fd",
            0.4: "#3b82f6",
            0.6: "#f97316",
            0.8: "#ef4444",
            1.0: "#8b5cf6",
          },
        }).addTo(map);
      }
      return;
    }

    markers.forEach((marker) => {
      const color =
        marker.severity === "high"
          ? "#ef4444"
          : marker.severity === "medium"
          ? "#f97316"
          : "#3b82f6";

      const customIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background:${color};
          width:28px;height:28px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#fff;border:2px solid #fff;
          box-shadow:0 2px 4px rgba(0,0,0,.2);
          font-size:11px;font-weight:700;
        ">${marker.count}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const lm = L.marker([marker.lat, marker.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:200px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">${marker.barangay}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div>🦠 Cases: ${marker.caseCount}</div>
              <div>⚠️ Severity: ${marker.severity}</div>
              <div>📊 Status: ${marker.status}</div>
              <div>🏷️ Disease: ${marker.disease || "Various"}</div>
            </div>
          </div>
        `);

      lm.on("click", () => onMarkerClick?.(marker.barangay));
      markersRef.current.push(lm);
    });

    if (markers.length) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers, heatmapData, layer, onMarkerClick]);

  return (
    <div
      ref={mapRef}
      style={{ height: "420px", width: "100%", borderRadius: "8px", zIndex: 1 }}
    />
  );
}

export default function P3GISHotspots() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState("heatmap");
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ hotspots: true });
  const [mapFocus, setMapFocus] = useState({ center: NAUJAN_CENTER, zoom: 11 });
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // =========================
  // LOAD CASES FROM FIRESTORE
  // =========================
  useEffect(() => {
    setLoading(true);
    setError("");

    const casesQuery = query(
      collection(db, "program3_cases"),
      orderBy("reportedDate", "desc")
    );

    const unsubCases = onSnapshot(
      casesQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCases(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading cases:", err);
        setError("Failed to load case data.");
        setLoading(false);
      }
    );

    return () => unsubCases();
  }, []);

  // =========================
  // BARANGAY STATISTICS
  // =========================
  const barangayStats = useMemo(() => {
    const stats = {};

    BARANGAYS.forEach((b) => {
      stats[b] = {
        barangay: b,
        caseCount: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        statuses: {},
        diseases: {},
        lastCase: null,
        lastCaseMs: 0,
        coordinates: getBarangayCoordinates(b),
      };
    });

    cases.forEach((caseItem) => {
      const b = caseItem.barangay;
      if (b && stats[b]) {
        stats[b].caseCount++;

        if (caseItem.severity === "high") stats[b].highSeverity++;
        else if (caseItem.severity === "medium") stats[b].mediumSeverity++;
        else if (caseItem.severity === "low") stats[b].lowSeverity++;

        const status = caseItem.status || "reported";
        stats[b].statuses[status] = (stats[b].statuses[status] || 0) + 1;

        const disease = caseItem.disease || "Unknown";
        stats[b].diseases[disease] = (stats[b].diseases[disease] || 0) + 1;

        const ms = toMillis(caseItem.reportedDate);
        if (!stats[b].lastCaseMs || ms > stats[b].lastCaseMs) {
          stats[b].lastCaseMs = ms;
          stats[b].lastCase = caseItem.reportedDate;
        }
      }
    });

    Object.keys(stats).forEach((b) => {
      delete stats[b].lastCaseMs;
    });

    return stats;
  }, [cases]);

  // =========================
  // OVERALL STATISTICS
  // =========================
  const totals = useMemo(() => {
    const totalCases = cases.length;
    const highSeverity = cases.filter((c) => c.severity === "high").length;
    const mediumSeverity = cases.filter((c) => c.severity === "medium").length;
    const lowSeverity = cases.filter((c) => c.severity === "low").length;
    const activeBarangays = Object.values(barangayStats).filter(
      (b) => b.caseCount > 0
    ).length;
    const openCases = cases.filter((c) => c.status !== "closed").length;

    return {
      totalCases,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      activeBarangays,
      openCases,
    };
  }, [cases, barangayStats]);

  // =========================
  // LAYER HELPERS
  // =========================
  const layerLabel = useMemo(() => {
    if (layer === "severity") return "Severity";
    if (layer === "status") return "Status";
    return "Cases";
  }, [layer]);

  const isHeatLayer = layer !== "markers";

  const getLayerValue = (s) => {
    if (layer === "severity") return s.highSeverity * 3 + s.mediumSeverity * 2 + s.lowSeverity;
    if (layer === "status") {
      const open = (s.statuses.reported || 0) + (s.statuses.suspected || 0) + (s.statuses.investigated || 0) + (s.statuses.confirmed || 0);
      return open;
    }
    return s.caseCount || 0;
  };

  // =========================
  // MAP DATA
  // =========================
  const mapMarkers = useMemo(() => {
    const all = Object.values(barangayStats);

    return all
      .filter((s) => s.caseCount > 0)
      .map((s) => {
        let severity = "low";
        if (s.highSeverity > 0) severity = "high";
        else if (s.mediumSeverity > 0) severity = "medium";

        let status = "reported";
        if (s.statuses.closed) status = "closed";
        else if (s.statuses.confirmed) status = "confirmed";
        else if (s.statuses.investigated) status = "investigated";
        else if (s.statuses.suspected) status = "suspected";

        // Get most common disease
        let disease = "Various";
        if (Object.keys(s.diseases).length > 0) {
          const sorted = Object.entries(s.diseases).sort((a, b) => b[1] - a[1]);
          disease = sorted[0][0];
        }

        return {
          ...s,
          lat: s.coordinates[0],
          lng: s.coordinates[1],
          count: s.caseCount,
          severity,
          status,
          disease,
        };
      });
  }, [barangayStats]);

  const heatmapPoints = useMemo(() => {
    const all = Object.values(barangayStats);
    const maxValue = Math.max(...all.map(getLayerValue), 1);

    return all
      .filter((s) => getLayerValue(s) > 0)
      .map((s) => ({
        lat: s.coordinates[0],
        lng: s.coordinates[1],
        intensity: getLayerValue(s) / maxValue,
      }));
  }, [barangayStats, layer]);

  // =========================
  // HEATMAP TABLE DATA
  // =========================
  const heatmapData = useMemo(() => {
    const all = Object.values(barangayStats);
    const maxValue = Math.max(...all.map(getLayerValue), 1);

    return BARANGAYS.map((barangay) => {
      const stats = barangayStats[barangay] || {
        caseCount: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
      };
      const value = getLayerValue(stats);
      const color = getHeatmapColor(value, maxValue);

      let densityLevel = "low";
      if (maxValue > 0) {
        const ratio = value / maxValue;
        if (ratio >= 0.75) densityLevel = "very_high";
        else if (ratio >= 0.5) densityLevel = "high";
        else if (ratio >= 0.25) densityLevel = "medium";
      }

      return {
        ...stats,
        barangay,
        heatValue: value,
        heatColor: color,
        densityLevel,
      };
    });
  }, [barangayStats, layer]);

  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return heatmapData;
    return heatmapData.filter((h) => h.barangay.toLowerCase().includes(n));
  }, [heatmapData, search]);

  // =========================
  // RECENT CASES
  // =========================
  const recentCases = useMemo(() => {
    return cases.slice(0, 15).map((c) => ({
      id: c.id,
      disease: c.disease || "Unknown",
      barangay: c.barangay || "Unknown",
      severity: c.severity || "medium",
      status: c.status || "reported",
      date: c.reportedDate,
      reporter: c.reporter || "—",
    }));
  }, [cases]);

  // =========================
  // SELECTED BARANGAY DETAILS
  // =========================
  const selectedDetails = useMemo(() => {
    if (!selectedBarangay) return null;
    return barangayStats[selectedBarangay] || null;
  }, [selectedBarangay, barangayStats]);

  const barangayCases = useMemo(() => {
    if (!selectedBarangay) return [];
    return cases.filter((c) => c.barangay === selectedBarangay).slice(0, 5);
  }, [cases, selectedBarangay]);

  // =========================
  // UI HELPERS
  // =========================
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleMarkerClick = (barangay) => {
    setSelectedBarangay(barangay);
    const coords = getBarangayCoordinates(barangay);
    setMapFocus({ center: coords, zoom: 14 });
  };

  // =========================
  // EXPORT HANDLER
  // =========================
  const handleExport = useCallback(
    async ({ format, dateRange, includeDetails }) => {
      const filteredCases = includeDetails.cases
        ? cases.filter((c) => {
            const d = c.reportedDate ? new Date(c.reportedDate) : null;
            if (!d) return false;
            return d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
          })
        : [];

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || auth.currentUser?.uid || "Unknown",
        dateRange,
        summary: includeDetails.summary
          ? {
              province: DEFAULT_PROVINCE,
              municipality: DEFAULT_MUNICIPALITY,
              totalCases: totals.totalCases,
              highSeverity: totals.highSeverity,
              mediumSeverity: totals.mediumSeverity,
              lowSeverity: totals.lowSeverity,
              openCases: totals.openCases,
              activeBarangays: `${totals.activeBarangays}/${BARANGAYS.length}`,
              filteredCases: filteredCases.length,
            }
          : undefined,
        barangays: includeDetails.barangays
          ? BARANGAYS.map((b) => {
              const s = barangayStats[b] || {};
              const coords = getBarangayCoordinates(b);
              return {
                barangay: b,
                cases: s.caseCount || 0,
                highSeverity: s.highSeverity || 0,
                mediumSeverity: s.mediumSeverity || 0,
                lowSeverity: s.lowSeverity || 0,
                lastCase: s.lastCase ? formatDate(s.lastCase) : "",
                lat: coords[0],
                lng: coords[1],
              };
            })
          : undefined,
        cases: includeDetails.cases
          ? filteredCases.map((c) => ({
              id: c.id,
              disease: c.disease || "",
              barangay: c.barangay || "",
              status: c.status || "",
              severity: c.severity || "",
              reportedDate: c.reportedDate ? formatDate(c.reportedDate) : "",
              symptoms: Array.isArray(c.symptoms) ? c.symptoms.join(", ") : "",
              reporter: c.reporter || "",
              notes: c.notes || "",
            }))
          : undefined,
        hotspots: includeDetails.hotspots
          ? Object.values(barangayStats)
              .filter((s) => s.caseCount > 0)
              .sort((a, b) => b.caseCount - a.caseCount)
              .map((s) => ({
                barangay: s.barangay,
                totalCases: s.caseCount,
                highSeverity: s.highSeverity,
                mediumSeverity: s.mediumSeverity,
                lowSeverity: s.lowSeverity,
                diseases: Object.keys(s.diseases).join(", "),
                lastCase: s.lastCase ? formatDate(s.lastCase) : "",
              }))
          : undefined,
      };

      // JSON
      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gis_hotspots_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        return;
      }

      // CSV
      if (format === "csv") {
        let csv = "GIS HOTSPOTS EXPORT REPORT\n";
        csv += `Exported: ${new Date().toLocaleString("en-PH")}\n`;
        csv += `Exported By: ${exportPayload.exportedBy}\n`;
        csv += `Date Range: ${dateRange.start} to ${dateRange.end}\n\n`;

        if (includeDetails.summary && exportPayload.summary) {
          csv += "SUMMARY\n";
          Object.entries(exportPayload.summary).forEach(([k, v]) => {
            csv += `${k},${String(v)}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.barangays && exportPayload.barangays?.length) {
          csv += "BARANGAY COVERAGE\n";
          csv +=
            "Barangay,Cases,High Severity,Medium Severity,Low Severity,Last Case,Lat,Lng\n";
          exportPayload.barangays.forEach((r) => {
            csv += `"${r.barangay}",${r.cases},${r.highSeverity},${r.mediumSeverity},${r.lowSeverity},"${r.lastCase}",${r.lat},${r.lng}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.cases && exportPayload.cases?.length) {
          csv += "CASES\n";
          csv += "Disease,Barangay,Status,Severity,Reported Date,Symptoms,Reporter,Notes\n";
          exportPayload.cases.forEach((c) => {
            csv += `"${c.disease}","${c.barangay}","${c.status}","${c.severity}","${c.reportedDate}","${c.symptoms}","${c.reporter}","${(c.notes || "").replace(/"/g, "'")}"\n`;
          });
          csv += "\n";
        }

        if (includeDetails.hotspots && exportPayload.hotspots?.length) {
          csv += "HOTSPOTS\n";
          csv += "Barangay,Total Cases,High Severity,Medium Severity,Low Severity,Diseases,Last Case\n";
          exportPayload.hotspots.forEach((h) => {
            csv += `"${h.barangay}",${h.totalCases},${h.highSeverity},${h.mediumSeverity},${h.lowSeverity},"${h.diseases}","${h.lastCase}"\n`;
          });
          csv += "\n";
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gis_hotspots_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        return;
      }

      // PDF
      if (format === "pdf") {
        const docPdf = new jsPDF({ orientation: "landscape" });
        const fileName = `gis_hotspots_report_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.pdf`;

        docPdf.setFontSize(14);
        docPdf.text(
          `GIS HOTSPOTS REPORT - ${DEFAULT_MUNICIPALITY}, ${DEFAULT_PROVINCE}`,
          14,
          14
        );

        docPdf.setFontSize(10);
        const meta = [
          `Exported: ${new Date().toLocaleString("en-PH")}`,
          `Exported By: ${exportPayload.exportedBy}`,
          `Date Range: ${dateRange.start} to ${dateRange.end}`,
          `Layer View: ${layerLabel} (${isHeatLayer ? "Heatmap" : "Markers"})`,
        ];
        let y = 22;
        meta.forEach((line) => {
          docPdf.text(line, 14, y);
          y += 5;
        });

        if (includeDetails.summary && exportPayload.summary) {
          autoTable(docPdf, {
            startY: y + 2,
            head: [["Metric", "Value"]],
            body: [
              ["Total Cases", String(totals.totalCases)],
              ["High Severity", String(totals.highSeverity)],
              ["Medium Severity", String(totals.mediumSeverity)],
              ["Low Severity", String(totals.lowSeverity)],
              ["Open Cases", String(totals.openCases)],
              ["Active Barangays", `${totals.activeBarangays}/${BARANGAYS.length}`],
              ["Filtered Cases", String(filteredCases.length)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });
          y = docPdf.lastAutoTable.finalY + 10;
        }

        const ensureSpace = (need = 25) => {
          const pageH = docPdf.internal.pageSize.getHeight();
          if (y + need > pageH - 10) {
            docPdf.addPage();
            y = 14;
          }
        };

        if (includeDetails.barangays && exportPayload.barangays?.length) {
          ensureSpace(30);
          docPdf.setFontSize(12);
          docPdf.text("Barangay Coverage", 14, y);
          y += 4;

          const top = exportPayload.barangays
            .slice()
            .sort((a, b) => b.cases - a.cases)
            .slice(0, 40);

          autoTable(docPdf, {
            startY: y,
            head: [
              ["Barangay", "Cases", "High", "Medium", "Low", "Last Case"],
            ],
            body: top.map((r) => [
              r.barangay,
              String(r.cases),
              String(r.highSeverity),
              String(r.mediumSeverity),
              String(r.lowSeverity),
              r.lastCase || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });
          y = docPdf.lastAutoTable.finalY + 10;
        }

        if (includeDetails.hotspots && exportPayload.hotspots?.length) {
          ensureSpace(30);
          docPdf.setFontSize(12);
          docPdf.text("Hotspots (Top 20)", 14, y);
          y += 4;

          const top = exportPayload.hotspots.slice(0, 20);

          autoTable(docPdf, {
            startY: y,
            head: [
              ["Barangay", "Total", "High", "Medium", "Low", "Diseases", "Last Case"],
            ],
            body: top.map((h) => [
              h.barangay,
              String(h.totalCases),
              String(h.highSeverity),
              String(h.mediumSeverity),
              String(h.lowSeverity),
              h.diseases || "",
              h.lastCase || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });
          y = docPdf.lastAutoTable.finalY + 10;
        }

        const pageCount = docPdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          docPdf.setPage(i);
          docPdf.setFontSize(8);
          docPdf.text(
            `Page ${i} of ${pageCount}`,
            docPdf.internal.pageSize.getWidth() - 30,
            docPdf.internal.pageSize.getHeight() - 8
          );
        }

        docPdf.save(fileName);
        return;
      }

      // XLSX
      if (format === "xlsx") {
        const wb = new ExcelJS.Workbook();
        wb.creator = "ANIMIS";
        wb.created = new Date();

        if (includeDetails.summary) {
          const ws = wb.addWorksheet("Summary");
          ws.addRow(["Province", DEFAULT_PROVINCE]);
          ws.addRow(["Municipality", DEFAULT_MUNICIPALITY]);
          ws.addRow(["Exported At", new Date().toLocaleString("en-PH")]);
          ws.addRow(["Exported By", exportPayload.exportedBy]);
          ws.addRow(["Date Range", `${dateRange.start} to ${dateRange.end}`]);
          ws.addRow([]);
          ws.addRow(["Total Cases", totals.totalCases]);
          ws.addRow(["High Severity", totals.highSeverity]);
          ws.addRow(["Medium Severity", totals.mediumSeverity]);
          ws.addRow(["Low Severity", totals.lowSeverity]);
          ws.addRow(["Open Cases", totals.openCases]);
          ws.addRow(["Active Barangays", `${totals.activeBarangays}/${BARANGAYS.length}`]);
          ws.columns = [{ width: 24 }, { width: 42 }];
        }

        if (includeDetails.barangays) {
          const wsB = wb.addWorksheet("Barangays");
          wsB.columns = [
            { header: "Barangay", key: "barangay", width: 22 },
            { header: "Cases", key: "cases", width: 10 },
            { header: "High Severity", key: "highSeverity", width: 14 },
            { header: "Medium Severity", key: "mediumSeverity", width: 16 },
            { header: "Low Severity", key: "lowSeverity", width: 14 },
            { header: "Last Case", key: "lastCase", width: 16 },
            { header: "Lat", key: "lat", width: 12 },
            { header: "Lng", key: "lng", width: 12 },
          ];
          wsB.getRow(1).font = { bold: true };
          (exportPayload.barangays || []).forEach((r) => wsB.addRow(r));
        }

        if (includeDetails.cases) {
          const wsC = wb.addWorksheet("Cases");
          wsC.columns = [
            { header: "Disease", key: "disease", width: 18 },
            { header: "Barangay", key: "barangay", width: 18 },
            { header: "Status", key: "status", width: 14 },
            { header: "Severity", key: "severity", width: 12 },
            { header: "Reported Date", key: "reportedDate", width: 16 },
            { header: "Symptoms", key: "symptoms", width: 30 },
            { header: "Reporter", key: "reporter", width: 18 },
            { header: "Notes", key: "notes", width: 30 },
          ];
          wsC.getRow(1).font = { bold: true };
          (exportPayload.cases || []).forEach((c) => wsC.addRow(c));
        }

        if (includeDetails.hotspots) {
          const wsH = wb.addWorksheet("Hotspots");
          wsH.columns = [
            { header: "Barangay", key: "barangay", width: 22 },
            { header: "Total Cases", key: "totalCases", width: 12 },
            { header: "High Severity", key: "highSeverity", width: 14 },
            { header: "Medium Severity", key: "mediumSeverity", width: 16 },
            { header: "Low Severity", key: "lowSeverity", width: 14 },
            { header: "Diseases", key: "diseases", width: 30 },
            { header: "Last Case", key: "lastCase", width: 16 },
          ];
          wsH.getRow(1).font = { bold: true };
          (exportPayload.hotspots || []).forEach((h) => wsH.addRow(h));
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(
          new Blob([buf], {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          `GIS_Hotspots_${DEFAULT_MUNICIPALITY}_${new Date()
            .toISOString()
            .split("T")[0]}.xlsx`
        );
      }
    },
    [cases, totals, barangayStats, layer, layerLabel, isHeatLayer]
  );

  if (loading) {
    return (
      <div className="p1g-page p1-fontPro">
        <div className="p1g-loading">
          <MapPinned size={40} />
          <div>Loading GIS hotspots...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p1g-page p1-fontPro">
      {/* Header */}
      <div className="p1g-head">
        <div className="p1g-titleBlock">
          <div className="p1g-h1">GIS Hotspots</div>
          <div className="p1g-sub">
            Disease surveillance and hotspot mapping in {DEFAULT_MUNICIPALITY}
          </div>
        </div>

        <div className="p1g-actions">
          <button
            className="p1g-iconBtn"
            onClick={() => setExportModalOpen(true)}
            title="Export Data"
            type="button"
          >
            <Download size={18} />
          </button>

          <button
            className="p1g-iconBtn"
            onClick={() => window.print()}
            title="Print"
            type="button"
          >
            <Printer size={18} />
          </button>

          <button
            className="p1g-iconBtn"
            onClick={() => window.location.reload()}
            title="Refresh"
            type="button"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p1g-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button className="p1g-error-close" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="p1g-stats">
        <div className="p1g-stat">
          <div className="p1g-statK">Total Cases</div>
          <div className="p1g-statV">{formatNumber(totals.totalCases)}</div>
          <div className="p1g-statS">All reported cases</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">High Severity</div>
          <div className="p1g-statV" style={{ color: "#ef4444" }}>
            {formatNumber(totals.highSeverity)}
          </div>
          <div className="p1g-statS">Critical cases</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">Open Cases</div>
          <div className="p1g-statV" style={{ color: "#f97316" }}>
            {formatNumber(totals.openCases)}
          </div>
          <div className="p1g-statS">Not yet closed</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">Coverage</div>
          <div className="p1g-statV">
            {totals.activeBarangays}/{BARANGAYS.length}
          </div>
          <div className="p1g-statS">Affected barangays</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p1g-toolbar">
        <div className="p1g-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search barangay..."
          />
          {search && (
            <button className="p1g-clear" onClick={() => setSearch("")}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="p1g-filter">
          <Filter size={16} />
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            <option value="heatmap">Cases (Heatmap)</option>
            <option value="markers">Cases (Markers)</option>
            <option value="severity">Severity (Heatmap)</option>
            <option value="status">Status (Heatmap)</option>
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="p1g-grid">
        {/* Left Column - Heatmap */}
        <div className="p1g-card">
          <div className="p1g-cardTitle">
            <Layers size={18} /> Barangay Heatmap
            <span className="p1g-cardBadge">{filtered.length} barangays</span>
          </div>

          <div className="p1g-heatmap">
            <div className="p1g-heatmap-legend">
              <span>Low</span>
              <div className="p1g-legend-gradient">
                <span style={{ background: "#93c5fd" }} />
                <span style={{ background: "#3b82f6" }} />
                <span style={{ background: "#f97316" }} />
                <span style={{ background: "#ef4444" }} />
              </div>
              <span>High</span>
            </div>

            <div
              className="p1g-heatmap-miniLabel"
              style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}
            >
              Showing: <b>{layerLabel}</b>{" "}
              {isHeatLayer ? "(Heatmap)" : "(Markers)"}
            </div>

            <div className="p1g-heatmap-table">
              {filtered.map((item) => (
                <div
                  key={item.barangay}
                  className={`p1g-heatmap-row ${
                    selectedBarangay === item.barangay ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedBarangay(item.barangay);
                    const coords = getBarangayCoordinates(item.barangay);
                    setMapFocus({ center: coords, zoom: 14 });
                  }}
                  style={{ borderLeftColor: item.heatColor }}
                >
                  <div className="p1g-heatmap-barangay">
                    <span className="p1g-barangay-name">{item.barangay}</span>
                    <span className={`p1g-density-badge ${item.densityLevel}`}>
                      {item.densityLevel.replace("_", " ")}
                    </span>
                  </div>

                  <div className="p1g-heatmap-values">
                    <span
                      className="p1g-heatmap-value"
                      style={{ background: item.heatColor, color: "#fff" }}
                    >
                      {item.heatValue}
                    </span>

                    <div className="p1g-heatmap-stats">
                      <span title="Total Cases">
                        🦠 {item.caseCount || 0}
                      </span>
                      <span title="High Severity">
                        🔴 {item.highSeverity || 0}
                      </span>
                      <span title="Medium Severity">
                        🟠 {item.mediumSeverity || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Map Panel */}
          <div className="p1g-card">
            <div className="p1g-cardTitle">
              <MapPinned size={18} /> Interactive Map
              <span className="p1g-cardBadge">
                {isHeatLayer
                  ? `${layerLabel} Heatmap`
                  : `${mapMarkers.length} locations`}
              </span>
            </div>

            <div className="p1g-mapBox">
              <MapComponent
                center={mapFocus.center}
                zoom={mapFocus.zoom}
                markers={mapMarkers}
                heatmapData={heatmapPoints}
                layer={layer}
                onMarkerClick={handleMarkerClick}
              />
            </div>
          </div>

          {/* Selected Barangay Details */}
          {selectedBarangay && selectedDetails && (
            <div className="p1g-card">
              <div className="p1g-cardTitle">
                <Home size={18} /> {selectedBarangay} Details
                <button
                  className="p1g-close-btn"
                  onClick={() => {
                    setSelectedBarangay(null);
                    setMapFocus({ center: NAUJAN_CENTER, zoom: 11 });
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p1g-details-stats">
                <div className="p1g-detail-item">
                  <AlertOctagon size={16} />
                  <div>
                    <div className="p1g-detail-label">Total Cases</div>
                    <div className="p1g-detail-value">
                      {selectedDetails.caseCount}
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <AlertTriangle size={16} />
                  <div>
                    <div className="p1g-detail-label">High Severity</div>
                    <div className="p1g-detail-value" style={{ color: "#ef4444" }}>
                      {selectedDetails.highSeverity}
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <Droplet size={16} />
                  <div>
                    <div className="p1g-detail-label">Medium Severity</div>
                    <div className="p1g-detail-value" style={{ color: "#f97316" }}>
                      {selectedDetails.mediumSeverity}
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <CheckCircle2 size={16} />
                  <div>
                    <div className="p1g-detail-label">Low Severity</div>
                    <div className="p1g-detail-value" style={{ color: "#3b82f6" }}>
                      {selectedDetails.lowSeverity}
                    </div>
                  </div>
                </div>
              </div>

              {Object.keys(selectedDetails.diseases || {}).length > 0 && (
                <div className="p1g-details-section">
                  <div className="p1g-details-section-title">
                    Diseases Reported
                  </div>
                  <div className="p1g-disease-tags">
                    {Object.entries(selectedDetails.diseases)
                      .sort((a, b) => b[1] - a[1])
                      .map(([disease, count]) => (
                        <span key={disease} className="p1g-disease-tag">
                          <Thermometer size={14} />
                          {disease}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {barangayCases.length > 0 && (
                <div className="p1g-details-section">
                  <div className="p1g-details-section-title">
                    Recent Cases
                    <span className="p1g-section-badge">
                      {barangayCases.length}
                    </span>
                  </div>
                  {barangayCases.map((caseItem) => (
                    <div key={caseItem.id} className="p1g-case-item">
                      <div className="p1g-case-title">
                        {caseItem.disease || "Unknown Disease"}
                      </div>
                      <div className="p1g-case-meta">
                        <span
                          className={`p1g-case-badge ${caseItem.severity}`}
                        >
                          {caseItem.severity || "unknown"}
                        </span>
                        <span>•</span>
                        <span>{formatDate(caseItem.reportedDate)}</span>
                        <span>•</span>
                        <span
                          className={`p1g-case-status ${caseItem.status}`}
                        >
                          {caseItem.status || "reported"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDetails.lastCase && (
                <div className="p1g-details-footer">
                  <span>
                    Last case reported: {formatDate(selectedDetails.lastCase)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Cases */}
      <div className="p1g-card">
        <div className="p1g-cardTitle">
          <Activity size={18} /> Recent Cases
        </div>

        <div className="p1g-activity-list">
          {recentCases.map((caseItem) => (
            <div key={caseItem.id} className="p1g-activity-item">
              <div className="p1g-activity-icon">
                <AlertTriangle size={16} />
              </div>
              <div className="p1g-activity-content">
                <div className="p1g-activity-title">
                  {caseItem.disease}
                  <span
                    className={`p1g-case-badge ${caseItem.severity}`}
                    style={{ marginLeft: "8px" }}
                  >
                    {caseItem.severity}
                  </span>
                </div>
                <div className="p1g-activity-meta">
                  <span>{caseItem.barangay}</span>
                  <span>•</span>
                  <span>{formatDate(caseItem.date)}</span>
                  <span>•</span>
                  <span className={`p1g-case-status ${caseItem.status}`}>
                    {caseItem.status}
                  </span>
                </div>
                <div className="p1g-activity-subtitle">
                  Reporter: {caseItem.reporter}
                </div>
              </div>
            </div>
          ))}

          {recentCases.length === 0 && (
            <div className="p1g-empty">No cases reported</div>
          )}
        </div>
      </div>

      {/* Hotspots Table */}
      <div className="p1g-card">
        <div
          className="p1g-cardTitle"
          style={{ cursor: "pointer" }}
          onClick={() => toggleSection("hotspots")}
        >
          <AlertOctagon size={18} /> Hotspots Analysis
          <span className="p1g-cardBadge">
            {Object.values(barangayStats).filter((s) => s.caseCount > 0).length}{" "}
            affected
          </span>
          <button className="p1g-expand-btn" type="button">
            {expandedSections.hotspots ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
        </div>

        {expandedSections.hotspots && (
          <div className="p1g-missions-table">
            <table>
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>Cases</th>
                  <th>High</th>
                  <th>Medium</th>
                  <th>Low</th>
                  <th>Diseases</th>
                  <th>Last Case</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(barangayStats)
                  .filter((s) => s.caseCount > 0)
                  .sort((a, b) => b.caseCount - a.caseCount)
                  .map((stats) => {
                    const diseases = Object.keys(stats.diseases || {});
                    return (
                      <tr
                        key={stats.barangay}
                        className="p1g-mission-row"
                        onClick={() => {
                          setSelectedBarangay(stats.barangay);
                          const coords = getBarangayCoordinates(stats.barangay);
                          setMapFocus({ center: coords, zoom: 14 });
                        }}
                      >
                        <td className="p1g-mission-title-cell">
                          {stats.barangay}
                        </td>
                        <td>
                          <strong>{stats.caseCount}</strong>
                        </td>
                        <td style={{ color: "#ef4444" }}>
                          {stats.highSeverity}
                        </td>
                        <td style={{ color: "#f97316" }}>
                          {stats.mediumSeverity}
                        </td>
                        <td style={{ color: "#3b82f6" }}>
                          {stats.lowSeverity}
                        </td>
                        <td>{diseases.join(", ") || "—"}</td>
                        <td>{stats.lastCase ? formatDate(stats.lastCase) : "—"}</td>
                      </tr>
                    );
                  })}

                {Object.values(barangayStats).filter((s) => s.caseCount > 0)
                  .length === 0 && (
                  <tr>
                    <td colSpan={7} className="p1g-empty">
                      No hotspots detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}