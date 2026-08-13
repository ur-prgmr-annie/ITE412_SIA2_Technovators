import { useEffect, useMemo, useState } from "react";
import "../../styles/p1Overview.css";
import {
  ClipboardList,
  Stethoscope,
  Boxes,
  ThermometerSnowflake,
  MapPinned,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Package,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { db, rtdb } from "../../services/firebase";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { ref, onValue, off } from "firebase/database";

/* =========================================
   HELPERS
   ========================================= */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtPct(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

function isWithinDays(dateStr, days = 7) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  return ms >= 0 && ms <= days * 86400000;
}

function badgeClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OPTIMAL" || s === "NORMAL") return "ok";
  if (s === "WARNING" || s === "ALERT") return "warn";
  if (s === "OFFLINE") return "bad";
  return "neutral";
}

function toDateStringMaybe(tsOrString) {
  if (!tsOrString) return "";
  if (typeof tsOrString === "string") return tsOrString;
  if (tsOrString?.toDate) return tsOrString.toDate().toISOString().slice(0, 10);
  if (tsOrString instanceof Date) return tsOrString.toISOString().slice(0, 10);
  return "";
}

/* =========================================
   MINI LINE CHART (SVG)
   ========================================= */
function MiniLine({ points = [], height = 110 }) {
  const w = 520;
  const h = height;
  const pad = 12;

  const vals = points.length ? points : Array.from({ length: 12 }).map((_, i) => 40 + i * 2);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(1, maxV - minV);

  const xFor = (i) => pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1);
  const yFor = (v) => h - pad - ((v - minV) / range) * (h - pad * 2);

  const d = vals
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(clamp(v, -9999, 9999))}`)
    .join(" ");

  return (
    <svg className="p1o-miniChart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {Array.from({ length: 4 }).map((_, i) => (
        <line
          key={i}
          x1={pad}
          x2={w - pad}
          y1={pad + i * ((h - pad * 2) / 3)}
          y2={pad + i * ((h - pad * 2) / 3)}
          className="p1o-gridLine"
        />
      ))}
      <path d={d} className="p1o-line" />
      {vals.map((v, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3.2" className="p1o-dot" />
      ))}
    </svg>
  );
}

/* =========================================
   MAIN
   ========================================= */
export default function P1Overview() {
  const navigate = useNavigate();

  const [animals, setAnimals] = useState([]);
  const [services, setServices] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [coldUnits, setColdUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    const qAnimals = query(collection(db, "program1_animals"), orderBy("createdAt", "desc"), limit(2000));

    const unsub = onSnapshot(
      qAnimals,
      (snap) => setAnimals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load animals.");
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    setErr("");
    const qServices = query(collection(db, "program1_routine_services"), orderBy("date", "desc"), limit(4000));

    const unsub = onSnapshot(
      qServices,
      (snap) => setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setErr("Failed to load service records.");
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    setErr("");

    const qInv = query(
      collection(db, "p1_inventory_batches"),
      orderBy("createdAt", "desc"),
      limit(4000)
    );

    const unsub = onSnapshot(
      qInv,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const today = new Date().toISOString().slice(0, 10);

        const valid = rows
          .filter((b) => Number(b.qtyOnHand || 0) > 0)
          .filter((b) => !b.expiryDate || b.expiryDate >= today)
          .sort((a, b) => {
            const aExp = a.expiryDate || "9999-12-31";
            const bExp = b.expiryDate || "9999-12-31";
            return aExp.localeCompare(bExp);
          });

        setInventoryBatches(valid);
      },
      (e) => {
        console.error(e);
        setErr("Failed to load inventory.");
      }
    );

    return () => unsub();
  }, []);

  // RTDB cold chain
  useEffect(() => {
    const coldRef = ref(rtdb, "coldchain");

    const handleValue = (snap) => {
      const data = snap.val() || {};

      const rows = Object.entries(data).map(([id, value]) => {
        const tempC = Number(value.coldTemp ?? value.tempC ?? 0);
        const humidity = Number(value.humidity ?? 0);
        const ambientTemp = Number(value.ambientTemp ?? 0);

        const tempMin = Number(value.limits?.tempMin ?? 2);
        const tempMax = Number(value.limits?.tempMax ?? 8);

        const tempOut = tempC < tempMin || tempC > tempMax;
        const humAlert = Boolean(value.humidityAlert ?? humidity > 80);
        const ambientAlert = Boolean(value.ambientAlert ?? ambientTemp > 30);
        const sensorFail = value.probeOk === false || value.dhtOk === false;

        const alerts =
          (tempOut ? 1 : 0) +
          (humAlert ? 1 : 0) +
          (ambientAlert ? 1 : 0) +
          (sensorFail ? 1 : 0);

        const updated = value.timestampMs
          ? new Date(value.timestampMs).toLocaleString("en-PH")
          : "";

        return {
          id,
          name: value.name || value.deviceId || id,
          status: value.status || (tempOut || humAlert || ambientAlert ? "WARNING" : "OPTIMAL"),
          tempC,
          humidity,
          ambientTemp,
          alerts,
          updated,
          updatedAt: value.timestampMs || null,
        };
      });

      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setColdUnits(rows);
    };

    onValue(coldRef, handleValue, (e) => {
      console.error(e);
    });

    return () => off(coldRef, "value", handleValue);
  }, []);

  useEffect(() => {
    setLoading(false);
  }, [animals, services, inventoryBatches, coldUnits]);

  const kpis = useMemo(() => {
    const totalAnimals = animals.length;
    const activeAnimals = animals.filter((a) => String(a.status || "").toLowerCase() === "active").length;

    const farmsCount =
      new Set(animals.map((a) => a.farmId || a.farmUID || a.ownerId || a.ownerUID).filter(Boolean)).size || 0;

    const totalServices = services.length;

    const vaccinated = services.filter((s) => String(s.activity || s.type || "").toLowerCase().includes("vacc")).length;
    const dewormed = services.filter((s) => String(s.activity || s.type || "").toLowerCase().includes("deworm")).length;
    const treated = services.filter((s) => String(s.activity || s.type || "").toLowerCase().includes("treat")).length;

    const last7dServices = services.filter((s) => {
      const ds = toDateStringMaybe(s.date || s.serviceDate || s.createdAt);
      return isWithinDays(ds, 7);
    }).length;

    const vaccinatedSet = new Set(
      services
        .filter((s) => String(s.activity || s.type || "").toLowerCase().includes("vacc"))
        .map((s) => s.animalId || s.animalTagId || s.tagId)
        .filter(Boolean)
    );
    const vaccinationCoverage = totalAnimals ? (vaccinatedSet.size / totalAnimals) * 100 : 0;

    const byItem = new Map();
    for (const b of inventoryBatches) {
      const name = b.itemName || b.name || "Unknown";
      const key = `${(b.category || "Other").toString()}::${name.toString()}`;
      const qty = Number(b.qtyOnHand || 0);
      const reorder = Number(b.reorderPoint ?? b.reorderLevel ?? 0);

      const cur = byItem.get(key) || {
        item: name,
        category: b.category || "Other",
        onHand: 0,
        reorderLevel: reorder || 0,
        unit: b.unit || "",
      };
      cur.onHand += qty;
      cur.reorderLevel = Math.max(cur.reorderLevel || 0, reorder || 0);
      byItem.set(key, cur);
    }

    const inventoryItemsAgg = Array.from(byItem.values());
    const lowStock = inventoryItemsAgg.filter((i) => (i.onHand ?? 0) <= (i.reorderLevel ?? 0));
    const lowStockCount = lowStock.length;

    const coldAlerts = coldUnits.reduce((sum, u) => sum + (u.alerts || 0), 0);
    const offlineCount = coldUnits.filter((u) => String(u.status).toUpperCase() === "OFFLINE").length;

    const base = Math.min(100, Math.max(10, totalServices * 2));
    const trend = Array.from({ length: 12 }).map((_, idx) => clamp(base + idx * 3 - (idx % 3) * 4, 10, 100));

    return {
      totalAnimals,
      activeAnimals,
      farmsCount,
      totalServices,
      vaccinated,
      dewormed,
      treated,
      last7dServices,
      vaccinationCoverage,
      lowStockCount,
      coldAlerts,
      offlineCount,
      trend,
      lowStock,
    };
  }, [animals, services, inventoryBatches, coldUnits]);

  const topBarangays = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const b = s.barangay || s.farmBarangay || "Unknown";
      map.set(b, (map.get(b) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [services]);

  const byServiceType = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const t = s.activity || s.type || "Unknown";
      map.set(t, (map.get(t) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [services]);

  const recentActivity = useMemo(() => {
    const svc = services
      .slice()
      .sort((a, b) => String(b.date || b.serviceDate || "").localeCompare(String(a.date || a.serviceDate || "")))
      .slice(0, 3)
      .map((s) => {
        const owner =
          s.ownerName ||
          `${s.firstName || ""} ${s.lastName || ""}`.trim() ||
          `${s.ownerFirstName || ""} ${s.ownerLastName || ""}`.trim() ||
          "Unknown Owner";

        const place = s.barangay || s.farmBarangay || "Unknown Location";
        const serviceMade = s.activity || s.type || "Service";

        return {
          title: serviceMade,
          sub: `${place} • Owner: ${owner}`,
          date: toDateStringMaybe(s.date || s.serviceDate) || "—",
          tone: "ok",
        };
      });

    return svc;
  }, [services]);

  return (
    <div className="p1o">
      <div className="p1o-head">
        <div className="p1o-headLeft">
          <div className="p1o-h1">Program 1 Overview</div>
          <div className="p1o-sub">
            Dashboard snapshot powered by Program 1 modules (Registration, Services, Inventory, Cold Chain).
          </div>
        </div>

        <div className="p1o-headRight">
          <button className="p1o-btn ghost" type="button" onClick={() => navigate("/program/animal-health-protection/reports")}>
            <BarChart3 size={16} /> Open Reports
          </button>
          <button className="p1o-btn" type="button" onClick={() => navigate("/program/animal-health-protection/services")}>
            <Stethoscope size={16} /> Add Service
          </button>
        </div>
      </div>

      {err ? <div className="p1o-error">{err}</div> : null}
      {loading ? <div className="p1o-loading">Loading dashboard…</div> : null}

      <div className="p1o-kpis">
        <div className="p1o-kpi">
          <div className="k-top">
            <span className="k-ico"><ClipboardList size={16} /></span>
            <div className="k-label">Registered Animals</div>
          </div>
          <div className="k-value">{kpis.totalAnimals}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.activeAnimals} active</span>
            <span className="dot">•</span>
            <span className="muted">{kpis.farmsCount} farms</span>
          </div>
        </div>

        <div className="p1o-kpi">
          <div className="k-top">
            <span className="k-ico"><Activity size={16} /></span>
            <div className="k-label">Service Records</div>
          </div>
          <div className="k-value">{kpis.totalServices}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.last7dServices} last 7 days</span>
            <span className="dot">•</span>
            <span className="muted">vacc/deworm/treat tracked</span>
          </div>
        </div>

        <div className="p1o-kpi">
          <div className="k-top">
            <span className="k-ico"><TrendingUp size={16} /></span>
            <div className="k-label">Vaccination Coverage</div>
          </div>
          <div className="k-value">{fmtPct(kpis.vaccinationCoverage)}</div>
          <div className="k-meta">
            <span className="pill ok">{kpis.vaccinated} vaccinated records</span>
            <span className="dot">•</span>
            <span className="muted">proxy from services</span>
          </div>
        </div>

        <div className="p1o-kpi">
          <div className="k-top">
            <span className="k-ico"><Package size={16} /></span>
            <div className="k-label">Inventory Alerts</div>
          </div>
          <div className="k-value">{kpis.lowStockCount}</div>
          <div className="k-meta">
            <span className={`pill ${kpis.lowStockCount ? "warn" : "ok"}`}>
              {kpis.lowStockCount ? "low stock items" : "all good"}
            </span>
            <span className="dot">•</span>
            <span className="muted">reorder threshold</span>
          </div>
        </div>
      </div>

      <div className="p1o-row">
        <div className="p1o-cardWide">
          <div className="p1o-cardHead">
            <div className="p1o-cardTitle">
              <CalendarDays size={18} /> Services Trend
            </div>
            <button className="p1o-link" type="button" onClick={() => navigate("/program/animal-health-protection/reports")}>
              View analytics →
            </button>
          </div>

          <div className="p1o-chartMeta">
            <div className="p1o-miniStat">
              <div className="ms-label">Vaccinations</div>
              <div className="ms-value">{kpis.vaccinated}</div>
            </div>
            <div className="p1o-miniStat">
              <div className="ms-label">Deworming</div>
              <div className="ms-value">{kpis.dewormed}</div>
            </div>
            <div className="p1o-miniStat">
              <div className="ms-label">Treatments</div>
              <div className="ms-value">{kpis.treated}</div>
            </div>
          </div>

          <MiniLine points={kpis.trend} />
          <div className="p1o-chartHint">Now powered by live services count (replace with real time-series later).</div>
        </div>

        <div className="p1o-cardWide">
          <div className="p1o-cardHead">
            <div className="p1o-cardTitle">
              <Users size={18} /> Recent Activity
            </div>
            <button className="p1o-link" type="button" onClick={() => navigate("/program/animal-health-protection/services")}>
              Open services →
            </button>
          </div>

          <div className="p1o-feed">
            {recentActivity.map((e, idx) => (
              <div key={idx} className={`p1o-feedItem ${e.tone}`}>
                <div className="fi-left">
                  <div className="fi-title">
                    {e.tone === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{e.title}</span>
                  </div>
                  <div className="fi-sub">{e.sub}</div>
                </div>
                <div className="fi-date">{e.date}</div>
              </div>
            ))}
            {recentActivity.length === 0 ? <div className="p1o-empty">No activity yet.</div> : null}
          </div>
        </div>
      </div>

      <div className="p1o-row3">
        <div className="p1o-cardBox">
          <div className="p1o-cardHead">
            <div className="p1o-cardTitle">
              <MapPinned size={18} /> Top Barangays
            </div>
            <button className="p1o-link" type="button" onClick={() => navigate("/program/animal-health-protection/gis")}>
              Open GIS →
            </button>
          </div>

          <table className="p1o-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Services</th>
              </tr>
            </thead>
            <tbody>
              {topBarangays.map(([b, c]) => (
                <tr key={b}>
                  <td><b>{b}</b></td>
                  <td>{c}</td>
                </tr>
              ))}
              {topBarangays.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p1o-emptyRow">No services yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p1o-cardBox">
          <div className="p1o-cardHead">
            <div className="p1o-cardTitle">
              <Stethoscope size={18} /> Services by Type
            </div>
            <button className="p1o-link" type="button" onClick={() => navigate("/program/animal-health-protection/services")}>
              Manage →
            </button>
          </div>

          <table className="p1o-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {byServiceType.map(([t, c]) => (
                <tr key={t}>
                  <td><b>{t}</b></td>
                  <td>{c}</td>
                </tr>
              ))}
              {byServiceType.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p1o-emptyRow">No data yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="p1o-cardBox">
          <div className="p1o-cardHead">
            <div className="p1o-cardTitle">
              <ThermometerSnowflake size={18} /> Cold Chain Status
            </div>
            <button className="p1o-link" type="button" onClick={() => navigate("/program/animal-health-protection/cold-chain")}>
              Open →
            </button>
          </div>

          <div className="p1o-ccList">
            {coldUnits.map((u) => (
              <div key={u.id} className="p1o-ccItem">
                <div className="p1o-ccMain">
                  <div className="p1o-ccName">{u.name}</div>
                  <div className="p1o-ccMeta">
                    <span className={`p1o-badge ${badgeClass(u.status)}`}>{u.status}</span>
                    <span className="dot">•</span>
                    <span>{u.tempC}°C</span>
                    <span className="dot">•</span>
                    <span>{u.humidity}% RH</span>
                    <span className="dot">•</span>
                    <span>{u.alerts} alert(s)</span>
                  </div>
                </div>
                <div className="p1o-ccTime">{u.updated}</div>
              </div>
            ))}
            {coldUnits.length === 0 ? <div className="p1o-empty">No cold chain units found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}