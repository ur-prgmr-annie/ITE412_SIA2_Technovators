import { useEffect, useMemo, useState } from "react";
import "../../styles/p1ColdChain.css";
import {
  ThermometerSnowflake,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Cpu,
  Bell,
  History,
  Settings,
  RefreshCcw,
  ShieldAlert,
  DoorOpen,
  PlugZap,
} from "lucide-react";

import {
  subscribeDevices,
  subscribeReadings,
  updateDevice,
  addReading,
} from "../../services/program1ColdChainService";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatDateTime(value) {
  if (!value) return "—";

  if (typeof value === "number") {
    const date = value < 1000000000000 ? new Date(value * 1000) : new Date(value);
    return isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function P1ColdChain() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempInput, setTempInput] = useState("");

  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 5;

  useEffect(() => {
    const unsub = subscribeDevices(
      (items) => {
        setDevices(items || []);
        setSelectedId((prev) => {
          if (prev && items.some((d) => d.id === prev)) return prev;
          return items[0]?.id || "";
        });
      },
      (e) => setErr(e?.message || "Failed to load devices.")
    );

    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setReadings([]);
      return;
    }

    const unsub = subscribeReadings(
      selectedId,
      (items) => setReadings(items || []),
      (e) => setErr(e?.message || "Failed to load readings.")
    );

    return () => unsub?.();
  }, [selectedId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedId]);

  useEffect(() => {
    const nextAlerts = [];

    for (const d of devices) {
      if (d.lastTemp == null) continue;

      const minTemp = Number(d.minTemp ?? 2);
      const maxTemp = Number(d.maxTemp ?? 8);
      const lastTemp = Number(d.lastTemp);
      const lastHumidity = Number(d.lastHumidity ?? 0);
      const lastAmbientTemp = Number(d.lastAmbientTemp ?? 0);

      if (lastTemp < minTemp || lastTemp > maxTemp) {
        nextAlerts.push({
          id: `temp-${d.id}`,
          title: "Temperature Out of Range",
          level: "WARNING",
          deviceId: d.id,
          unit: d.name || d.deviceId || d.id,
          message: `Reading ${lastTemp}°C exceeded ${minTemp}–${maxTemp}°C`,
          time: formatDateTime(d.lastReadAt || d.updatedAt),
          acknowledged: false,
        });
      }

      if (d.ambientAlert || lastAmbientTemp > 30) {
        nextAlerts.push({
          id: `ambient-${d.id}`,
          title: "Ambient Temperature High",
          level: "WARNING",
          deviceId: d.id,
          unit: d.name || d.deviceId || d.id,
          message: `Ambient temperature is ${lastAmbientTemp}°C`,
          time: formatDateTime(d.lastReadAt || d.updatedAt),
          acknowledged: false,
        });
      }

      if (d.humidityAlert || lastHumidity > 80) {
        nextAlerts.push({
          id: `humidity-${d.id}`,
          title: "Humidity High",
          level: "WARNING",
          deviceId: d.id,
          unit: d.name || d.deviceId || d.id,
          message: `Humidity is ${lastHumidity}%`,
          time: formatDateTime(d.lastReadAt || d.updatedAt),
          acknowledged: false,
        });
      }

      if (d.probeOk === false || d.dhtOk === false) {
        nextAlerts.push({
          id: `sensor-${d.id}`,
          title: "Sensor Failure",
          level: "CRITICAL",
          deviceId: d.id,
          unit: d.name || d.deviceId || d.id,
          message: "One or more sensors are reporting an error.",
          time: formatDateTime(d.lastReadAt || d.updatedAt),
          acknowledged: false,
        });
      }
    }

    setAlerts(nextAlerts);
  }, [devices]);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) || null,
    [devices, selectedId]
  );

  const alertState = useMemo(() => {
    if (!selected) return "unknown";
    const last = selected.lastTemp;
    if (last == null) return "unknown";
    if (selected.alert) return "alert";
    if (last < selected.minTemp || last > selected.maxTemp) return "alert";
    return "ok";
  }, [selected]);

  const stats = useMemo(() => {
    const total = devices.length;
    const outOfRange = devices.filter(
      (d) =>
        d.lastTemp != null &&
        (Number(d.lastTemp) < Number(d.minTemp ?? 2) ||
          Number(d.lastTemp) > Number(d.maxTemp ?? 8))
    ).length;

    const online = devices.filter((d) => d.lastTemp != null).length;
    const validTemps = devices
      .filter((d) => d.lastTemp != null)
      .map((d) => Number(d.lastTemp));

    const avg =
      validTemps.reduce((acc, t) => acc + t, 0) / Math.max(1, validTemps.length);

    return {
      systemsOnline: `${online}/${total}`,
      activeAlerts: alerts.length,
      avgTemp: `${validTemps.length ? avg.toFixed(1) : "—"}°C`,
      outOfRange,
    };
  }, [devices, alerts]);

  const unackedCritical = useMemo(
    () => alerts.filter((a) => !a.acknowledged && a.level === "CRITICAL").length,
    [alerts]
  );

  const liveReadings = useMemo(() => readings.slice(0, 5), [readings]);

  const totalHistoryPages = useMemo(() => {
    return Math.max(1, Math.ceil(readings.length / HISTORY_PAGE_SIZE));
  }, [readings]);

  const paginatedHistoryReadings = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    const end = start + HISTORY_PAGE_SIZE;
    return readings.slice(start, end);
  }, [readings, historyPage]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  const refresh = () => {
    window.location.reload();
  };

  const pushReading = async () => {
    if (!selected) return setErr("Select a device first.");

    const t = Number(tempInput);
    if (Number.isNaN(t)) return setErr("Enter a valid temperature.");

    setBusy(true);
    setErr("");

    try {
      const minTemp = Number(selected.minTemp ?? 2);
      const maxTemp = Number(selected.maxTemp ?? 8);
      const alert = t < minTemp || t > maxTemp;

      await addReading({
        deviceDocId: selected.id,
        tempC: Number(t.toFixed(1)),
        ambientTemp: selected.lastAmbientTemp ?? null,
        humidity: selected.lastHumidity ?? null,
        status: alert ? "ALERT" : "NORMAL",
        alert,
        tempAlert: alert,
        humidityAlert: false,
        ambientAlert: false,
        probeOk: true,
        dhtOk: true,
      });

      setTempInput("");
    } catch (e) {
      setErr(e?.message || "Failed to add reading.");
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  const tempSeries12 = useMemo(() => {
    const latest = readings.slice(0, 12).reverse();
    const values = latest.map((r) => Number(r.tempC ?? 0));

    if (!values.length) {
      const fallback = [4.1, 4.2, 4.0, 4.1, 4.1, 4.2, 4.1, 4.2, 4.1, 4.2, 4.1, 4.2];
      return {
        labels: Array.from({ length: 12 }).map((_, i) => `${i + 1}`.padStart(2, "0")),
        forest: fallback,
        mint: fallback.map((v) => clamp(v - 0.2, 0, 10)),
        teal: fallback.map((v) => clamp(v + 0.2, 0, 10)),
      };
    }

    const padded = [...Array(Math.max(0, 12 - values.length)).fill(values[0] ?? 0), ...values];
    const labels = latest.map((r) => {
      const raw = r.readAt || r.readAtIso || r.createdAt;
      const dt =
        typeof raw === "number"
          ? new Date(raw < 1000000000000 ? raw * 1000 : raw)
          : new Date(raw);
      return isNaN(dt.getTime())
        ? "--:--"
        : dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });

    const paddedLabels = [
      ...Array(Math.max(0, 12 - labels.length)).fill("--:--"),
      ...labels,
    ];

    return {
      labels: paddedLabels,
      forest: padded,
      mint: padded.map((v) => clamp(v - 0.2, 0, 10)),
      teal: padded.map((v) => clamp(v + 0.2, 0, 10)),
    };
  }, [readings]);

  return (
    <div className="p1c">
      <div className="p1c-header">
        <div>
          <div className="p1c-breadcrumb">Cold Chain</div>
          <h1 className="p1c-title">Cold Chain Monitoring</h1>
          <p className="p1c-subtitle">IoT-powered vaccine storage monitoring</p>
        </div>

        <div className="p1c-headerRight">
          <div className="p1c-live">
            <span className="p1c-liveDot" />
            Live
          </div>
          <button className="p1c-iconBtn" onClick={refresh} type="button" title="Refresh">
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      <div className="p1c-tabs">
        <button
          className={`p1c-tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
          type="button"
        >
          <ThermometerSnowflake size={16} /> Dashboard
        </button>
        <button
          className={`p1c-tab ${activeTab === "alerts" ? "active" : ""}`}
          onClick={() => setActiveTab("alerts")}
          type="button"
        >
          <Bell size={16} /> Alerts
        </button>
        <button
          className={`p1c-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          type="button"
        >
          <History size={16} /> History
        </button>
        <button
          className={`p1c-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
          type="button"
        >
          <Settings size={16} /> Settings
        </button>
      </div>

      {err ? <div className="p1c-error">{err}</div> : null}

      {activeTab === "dashboard" && (
        <>
          <div className="p1c-stats">
            <div className="p1c-stat green">
              <div className="p1c-statLabel">Systems Online</div>
              <div className="p1c-statValue green">{stats.systemsOnline}</div>
              <div className="p1c-statSub">Active sensors</div>
            </div>

            <div className="p1c-stat red">
              <div className="p1c-statLabel">Active Alerts</div>
              <div className="p1c-statValue red">{stats.activeAlerts}</div>
              <div className="p1c-statSub">Needs attention</div>
            </div>

            <div className="p1c-stat mint">
              <div className="p1c-statLabel">Avg Temp</div>
              <div className="p1c-statValue mint">{stats.avgTemp}</div>
              <div className="p1c-statSub">Across devices</div>
            </div>

            <div className="p1c-stat forest">
              <div className="p1c-statLabel">Out of Range</div>
              <div className="p1c-statValue forest">{stats.outOfRange}</div>
              <div className="p1c-statSub">Today</div>
            </div>
          </div>

          <div className="p1c-grid">
            <div className="p1c-card">
              <div className="p1c-cardTitle">
                <ThermometerSnowflake size={18} /> Devices
                <span className="p1c-count">{devices.length}</span>
              </div>

              <div className="p1c-list">
                {devices.map((d) => {
                  const out =
                    d.lastTemp != null &&
                    (Number(d.lastTemp) < Number(d.minTemp ?? 2) ||
                      Number(d.lastTemp) > Number(d.maxTemp ?? 8));

                  return (
                    <button
                      key={d.id}
                      className={`p1c-item ${selected?.id === d.id ? "active" : ""}`}
                      onClick={() => setSelectedId(d.id)}
                      type="button"
                    >
                      <div className="p1c-itemTop">
                        <div className="p1c-itemName">
                          <b>{d.name || d.deviceId || d.id}</b>
                          <span className="p1c-chip">
                            <Cpu size={14} /> {d.deviceId || d.id}
                          </span>
                        </div>

                        <div className="p1c-itemRight">
                          <span className={`p1c-pill ${out ? "warning" : "ok"}`}>
                            {out ? "Warning" : "Optimal"}
                          </span>
                        </div>
                      </div>

                      <div className="p1c-itemSub">
                        <MapPin size={14} /> {d.location || "—"}
                      </div>

                      <div className="p1c-itemMeta">
                        <span className="p1c-range">
                          Vaccine range: <b>{d.minTemp ?? 2}°C</b> – <b>{d.maxTemp ?? 8}°C</b>
                        </span>
                        <span className="p1c-last">
                          Temp: <b>{d.lastTemp ?? "—"}</b>°C
                        </span>
                        <span className="p1c-last">
                          Humidity: <b>{d.lastHumidity ?? "—"}</b>%
                        </span>
                      </div>
                    </button>
                  );
                })}

                {devices.length === 0 && <div className="p1c-empty">No devices yet.</div>}
              </div>
            </div>

            <div className="p1c-card">
              <div className="p1c-cardTitle">
                <Activity size={18} /> Live Readings
                <span className={`p1c-state ${alertState}`}>
                  {alertState === "alert" ? (
                    <>
                      <AlertTriangle size={16} /> OUT OF RANGE
                    </>
                  ) : alertState === "ok" ? (
                    <>
                      <CheckCircle2 size={16} /> OK
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>

              <div className="p1c-deviceBanner">
                <div className="p1c-deviceBannerMain">
                  <div className="p1c-deviceBannerTitle">
                    {selected?.name || "No device selected"}
                  </div>
                  <div className="p1c-deviceBannerSub">
                    {selected ? (
                      <>
                        <span><Cpu size={14} /> {selected.deviceId || selected.id}</span>
                        <span className="dot">•</span>
                        <span><MapPin size={14} /> {selected.location || "—"}</span>
                      </>
                    ) : (
                      "Select a device to view readings."
                    )}
                  </div>
                </div>

                <div className="p1c-bannerTemp">
                  <div className="p1c-bannerTempLabel">Latest Temp</div>
                  <div className={`p1c-bannerTempValue ${alertState}`}>
                    {selected?.lastTemp ?? "—"}°C
                  </div>

                  <div className="p1c-bannerTempLabel" style={{ marginTop: "8px" }}>
                    Humidity
                  </div>
                  <div className="p1c-bannerTempValue">
                    {selected?.lastHumidity ?? "—"}%
                  </div>
                </div>
              </div>

              <div className="p1c-push">
                <input
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  placeholder="Manual temp input (e.g. 5.2)"
                />
                <button className="p1c-btn" onClick={pushReading} disabled={busy} type="button">
                  Add
                </button>
              </div>

              <div className="p1c-tableWrap">
                <table className="p1c-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Temp (°C)</th>
                      <th>Humidity (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveReadings.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.readAt || r.readAtIso || r.createdAt)}</td>
                        <td><b>{r.tempC ?? "—"}</b></td>
                        <td><b>{r.humidity ?? "—"}</b></td>
                      </tr>
                    ))}

                    {liveReadings.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p1c-emptyRow">No readings yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="p1c-card p1c-wide">
            <div className="p1c-cardHeader">
              <h3>Temperature Trends (Last 12 Readings)</h3>
              <div className="p1c-legend">
                <div className="p1c-leg"><span className="p1c-legDot forest" /> Actual</div>
                <div className="p1c-leg"><span className="p1c-legDot mint" /> Lower guide</div>
                <div className="p1c-leg"><span className="p1c-legDot teal" /> Upper guide</div>
              </div>
            </div>

            <div className="p1c-chartWrap">
              <svg className="p1c-chart" viewBox="0 0 1000 320" preserveAspectRatio="none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="50"
                    x2="980"
                    y1={40 + i * 35}
                    y2={40 + i * 35}
                    className="p1c-chartGrid"
                  />
                ))}
                {Array.from({ length: 12 }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={50 + i * 84.5}
                    x2={50 + i * 84.5}
                    y1="40"
                    y2="290"
                    className="p1c-chartGrid"
                  />
                ))}
                <line x1="50" x2="50" y1="30" y2="290" className="p1c-axis" />
                <line x1="50" x2="980" y1="290" y2="290" className="p1c-axis" />

                {tempSeries12.labels.map((h, i) => (
                  <text key={h + i} x={50 + i * 84.5} y="310" className="p1c-xtext" textAnchor="middle">
                    {h}
                  </text>
                ))}

                {(() => {
                  const xFor = (i) => 50 + i * 84.5;
                  const yFor = (v) => 290 - (clamp(v, 0, 10) / 10) * 250;
                  const toPath = (arr) =>
                    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

                  return (
                    <>
                      <path d={toPath(tempSeries12.forest)} className="p1c-line forest" />
                      <path d={toPath(tempSeries12.mint)} className="p1c-line mint" />
                      <path d={toPath(tempSeries12.teal)} className="p1c-line teal" />
                      {tempSeries12.forest.map((v, i) => (
                        <circle key={`f-${i}`} cx={xFor(i)} cy={yFor(v)} r="4" className="p1c-dot forest" />
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </>
      )}

      {activeTab === "alerts" && (
        <>
          {unackedCritical > 0 && (
            <div className="p1c-bannerCritical">
              <div className="p1c-bannerLeft">
                <ShieldAlert size={18} />
                <div>
                  <div className="p1c-bannerTitle">{unackedCritical} unacknowledged critical alerts</div>
                  <div className="p1c-bannerSub">require immediate attention</div>
                </div>
              </div>
            </div>
          )}

          <div className="p1c-alerts">
            {alerts.map((a) => (
              <div className={`p1c-alert ${a.acknowledged ? "ack" : ""}`} key={a.id}>
                <div className="p1c-alertLeft">
                  <div className="p1c-alertTitleRow">
                    <div className="p1c-alertTitle">{a.title}</div>
                    <span className={`p1c-pill ${a.level.toLowerCase()}`}>{a.level}</span>
                    {a.acknowledged && <span className="p1c-pill acknowledged">ACKNOWLEDGED</span>}
                  </div>
                  <div className="p1c-alertUnit">{a.unit}</div>
                  <div className="p1c-alertMsg">{a.message}</div>
                  <div className="p1c-alertTime">{a.time}</div>
                </div>

                {!a.acknowledged ? (
                  <button className="p1c-btnOutline" onClick={() => acknowledge(a.id)} type="button">
                    Acknowledge
                  </button>
                ) : (
                  <div className="p1c-ackIcon" title="Acknowledged">
                    <CheckCircle2 size={18} />
                  </div>
                )}
              </div>
            ))}

            {!alerts.length && <div className="p1c-empty">No active alerts.</div>}
          </div>

          <div className="p1c-card">
            <div className="p1c-cardTitle">
              <AlertTriangle size={18} /> Alert Thresholds
            </div>

            <div className="p1c-thresholds">
              <div className="p1c-thRow">
                <div>Vaccine Storage Range</div>
                <div className="p1c-thVal">2°C – 8°C</div>
              </div>
              <div className="p1c-thRow">
                <div>Critical Temperature Alert</div>
                <div className="p1c-thVal">&lt; 2°C or &gt; 8°C</div>
              </div>
              <div className="p1c-thRow">
                <div>Humidity Threshold</div>
                <div className="p1c-thVal">&gt; 80%</div>
              </div>
              <div className="p1c-thRow">
                <div>Ambient Temperature</div>
                <div className="p1c-thVal">&gt; 30°C</div>
              </div>
              <div className="p1c-thRow">
                <div>Sensor Health</div>
                <div className="p1c-thVal">Probe/DHT failure</div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "history" && (
        <>
          <div className="p1c-card">
            <div className="p1c-cardHeader">
              <h3>Temperature History</h3>
              <div className="p1c-auto">
                <RefreshCcw size={16} /> Live from RTDB
              </div>
            </div>

            <div className="p1c-tableWrap">
              <table className="p1c-table">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Temp (°C)</th>
                    <th>Ambient (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistoryReadings.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.readAt || r.readAtIso || r.createdAt)}</td>
                      <td>{r.tempC ?? "—"}</td>
                      <td>{r.ambientTemp ?? "—"}</td>
                      <td>{r.humidity ?? "—"}</td>
                      <td>{r.status ?? "—"}</td>
                    </tr>
                  ))}

                  {!paginatedHistoryReadings.length && (
                    <tr>
                      <td colSpan={5} className="p1c-emptyRow">No history available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p1c-pagination">
              <button
                className="p1c-btnOutline"
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
              >
                Previous
              </button>

              <div className="p1c-pageInfo">
                Page {historyPage} of {totalHistoryPages}
              </div>

              <button
                className="p1c-btnOutline"
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                disabled={historyPage === totalHistoryPages}
              >
                Next
              </button>
            </div>
          </div>

          <div className="p1c-card">
            <div className="p1c-cardTitle">WHO Temperature Standards</div>
            <div className="p1c-standards">
              <div className="p1c-std optimal">
                <span className="p1c-stdDot" />
                <b>Optimal Range:</b> 2°C – 8°C
              </div>
              <div className="p1c-std warning">
                <span className="p1c-stdDot" />
                <b>Warning:</b> Approaching 2°C or 8°C
              </div>
              <div className="p1c-std critical">
                <span className="p1c-stdDot" />
                <b>Critical:</b> &lt; 2°C or &gt; 8°C
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "settings" && (
        <div className="p1c-card">
          <div className="p1c-cardTitle">Sensor Configuration</div>

          <div className="p1c-settings">
            {devices.map((u) => {
              const out =
                u.lastTemp != null &&
                (Number(u.lastTemp) < Number(u.minTemp ?? 2) ||
                  Number(u.lastTemp) > Number(u.maxTemp ?? 8));

              return (
                <div className="p1c-sensor" key={`s-${u.id}`}>
                  <div className="p1c-sensorTop">
                    <div>
                      <div className="p1c-sensorName">{u.name || u.deviceId || u.id}</div>
                      <div className="p1c-sensorMeta">Sensor ID: {u.deviceId || u.id}</div>
                      <div className="p1c-sensorMeta">Location: {u.location || "—"}</div>
                    </div>

                    <span className={`p1c-pill ${out ? "warning" : "optimal"}`}>
                      {out ? "WARNING" : "OPTIMAL"}
                    </span>
                  </div>

                  <div className="p1c-sensorChips">
                    <span className="p1c-chipLite"><PlugZap size={14} /> connected</span>
                    <span className="p1c-chipLite"><DoorOpen size={14} /> closed</span>
                    <span className="p1c-chipLite">
                      <ThermometerSnowflake size={14} /> {u.minTemp ?? 2}–{u.maxTemp ?? 8}°C
                    </span>
                  </div>

                  <div className="p1c-sensorActions">
                    <button
                      className="p1c-btnOutline"
                      type="button"
                      onClick={async () => {
                        try {
                          const nextMin = prompt("Min temp", String(u.minTemp ?? 2));
                          const nextMax = prompt("Max temp", String(u.maxTemp ?? 8));
                          if (nextMin == null || nextMax == null) return;

                          await updateDevice(u.id, {
                            minTemp: Number(nextMin),
                            maxTemp: Number(nextMax),
                          });
                        } catch (e) {
                          setErr(e?.message || "Failed to update device.");
                        }
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}