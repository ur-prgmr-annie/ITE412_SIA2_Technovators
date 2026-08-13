import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import "../../styles/p1GIS.css";
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
  PawPrint,
  User,
  Package,
  Stethoscope,
  Home,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  Trash2,
  FileText,
  FileSpreadsheet,
  Download, // ✅ like Inventory
  CheckCircle2, // ✅ for modal footer note (same style)
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

// Barangay coordinates (approximate - refine with actual GPS)
const BARANGAY_COORDINATES = {
  "Poblacion I": [13.3236, 121.3027],
  "Poblacion II": [13.3245, 121.3035],
  "Poblacion III": [13.3228, 121.3019],
  "San Jose": [13.315, 121.295],
  "Bagong Buhay": [13.33, 121.31],
  "Sampaguita": [13.34, 121.315],
  "Bacungan": [13.285, 121.275],
  "Bancuro": [13.295, 121.285],
  "Barcenaga": [13.305, 121.295],
  "Mahabang Parang": [13.335, 121.32],
  "Malaya": [13.345, 121.325],
  "Montelago": [13.355, 121.335],
  "Nag-iba I": [13.365, 121.345],
  "Nag-iba II": [13.375, 121.355],
  "Pinagsabangan I": [13.385, 121.365],
  "Pinagsabangan II": [13.395, 121.375],
  "San Antonio": [13.405, 121.385],
  "San Isidro": [13.415, 121.395],
  "Santa Cruz": [13.425, 121.405],
  "Santa Maria": [13.435, 121.415],
  Santiago: [13.445, 121.425],
  "Santo Niño": [13.455, 121.435],
  Adrialuna: [13.315, 121.305],
  "Andres Ilagan": [13.325, 121.315],
  Antipolo: [13.335, 121.325],
  Apitong: [13.345, 121.335],
  Arangin: [13.355, 121.345],
  Aurora: [13.365, 121.355],
  Balite: [13.375, 121.365],
  Banuton: [13.385, 121.375],
  Bayani: [13.395, 121.385],
  Buhangin: [13.405, 121.395],
  Caburo: [13.415, 121.405],
  Concepcion: [13.425, 121.415],
  Dao: [13.435, 121.425],
  "Del Pilar": [13.445, 121.435],
  Estrella: [13.455, 121.445],
  Evangelista: [13.465, 121.455],
  Gamao: [13.475, 121.465],
  "General Esco": [13.485, 121.475],
  Herrera: [13.495, 121.485],
  Inarawan: [13.505, 121.495],
  Kalinisan: [13.515, 121.505],
  Laguna: [13.525, 121.515],
  Mabini: [13.535, 121.525],
  Magtibay: [13.545, 121.535],
  Malinao: [13.555, 121.545],
  Malvar: [13.565, 121.555],
  Masagana: [13.575, 121.565],
  Masaguing: [13.585, 121.575],
  "Melgar A": [13.595, 121.585],
  "Melgar B": [13.605, 121.595],
  Metolza: [13.615, 121.605],
  Montemayor: [13.625, 121.615],
  Motoderazo: [13.635, 121.625],
  Mulawin: [13.645, 121.635],
  Pagkakaisa: [13.655, 121.645],
  Pagsabangan: [13.665, 121.655],
  Paitan: [13.675, 121.665],
  Palhi: [13.685, 121.675],
  Paniquian: [13.695, 121.685],
  Piñahan: [13.705, 121.695],
  "San Agustín I": [13.715, 121.705],
  "San Agustín II": [13.725, 121.715],
  "San Andres": [13.735, 121.725],
  "San Carlos": [13.745, 121.735],
  "San Luis": [13.755, 121.745],
  "San Nicolas": [13.765, 121.755],
  "San Pedro": [13.775, 121.765],
  "Santa Isabel": [13.785, 121.775],
  Tagumpay: [13.795, 121.785],
  Tigkan: [13.805, 121.795],
  Tongyan: [13.815, 121.805],
};

const BARANGAYS = Object.keys(BARANGAY_COORDINATES);
const DEFAULT_COORDS = NAUJAN_CENTER;

const ACTIVITY_TYPES = [
  "Vaccination",
  "Deworming",
  "Vitamin Supplementation",
  "Treatment",
  "Castration",
  "Consultation",
  "Animal Inspection",
  "Farm Biosecurity",
  "Issued Disinfectant",
  "Issued Nets",
  "Issued Foot Baths",
  "Other",
];

// ✅ Export formats like Inventory (same pattern)
const EXPORT_FORMATS = [
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "csv", label: "CSV (Excel)" },
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

// date-range filter helper (inclusive)
function inRange(date, start, end) {
  if (!date) return false;
  const ms = toMillis(date);
  const s = new Date(start);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return ms >= s.getTime() && ms <= e.getTime();
}

// ========== CONFIRM MODAL ==========
function ConfirmModal({
  open,
  title,
  message,
  dangerText = "Delete",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;
  return (
    <div className="p1c-wrap" role="dialog" aria-modal="true">
      <button
        className="p1c-overlay"
        onClick={onCancel}
        aria-label="Close confirm"
      />
      <div className="p1c-card">
        <div className="p1c-head">
          <div className="p1c-titleRow">
            <AlertTriangle size={18} />
            <div className="p1c-title">{title}</div>
          </div>
          <button
            className="p1c-x"
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p1c-body">
          <div className="p1c-msg">{message}</div>
          <div className="p1c-actions">
            <button className="p1c-btn ghost" onClick={onCancel} type="button">
              Cancel
            </button>
            <button
              className="p1c-btn danger"
              onClick={onConfirm}
              type="button"
            >
              {dangerText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MISSION DETAIL MODAL ==========
function MissionDetailModal({ open, onClose, mission, onEdit, onDelete }) {
  if (!open || !mission) return null;

  return (
    <div className="p1g-modal-wrap" role="dialog" aria-modal="true">
      <div className="p1g-modal-overlay" onClick={onClose} />
      <div className="p1g-modal-card">
        <div className="p1g-modal-head">
          <div>
            <div className="p1g-modal-title">{mission.title}</div>
            <div className="p1g-modal-sub">
              {formatDate(mission.date)} • {mission.barangay}
            </div>
          </div>
          <button className="p1g-modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="p1g-modal-body">
          <div className="p1g-modal-section">
            <div className="p1g-modal-grid">
              <div className="p1g-modal-item">
                <div className="p1g-modal-label">Activity Type</div>
                <div className="p1g-modal-value">{mission.activity}</div>
              </div>
              <div className="p1g-modal-item">
                <div className="p1g-modal-label">Status</div>
                <div className="p1g-modal-value">
                  <span
                    className={`p1g-status-badge ${
                      mission.status || "planned"
                    }`}
                  >
                    {mission.status || "planned"}
                  </span>
                </div>
              </div>
              <div className="p1g-modal-item">
                <div className="p1g-modal-label">Animals Reached</div>
                <div className="p1g-modal-value">
                  {formatNumber(mission.animalsReached || 0)}
                </div>
              </div>
              <div className="p1g-modal-item">
                <div className="p1g-modal-label">Heads Treated</div>
                <div className="p1g-modal-value">
                  {formatNumber(mission.headsTreated || 0)}
                </div>
              </div>
            </div>
          </div>

          {mission.description && (
            <div className="p1g-modal-section">
              <div className="p1g-modal-label">Description</div>
              <div className="p1g-modal-description">{mission.description}</div>
            </div>
          )}

          {mission.team && mission.team.length > 0 && (
            <div className="p1g-modal-section">
              <div className="p1g-modal-label">Team Members</div>
              <div className="p1g-modal-team">
                {mission.team.map((member, idx) => (
                  <span key={idx} className="p1g-modal-team-member">
                    <User size={14} /> {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mission.usedItems && mission.usedItems.length > 0 && (
            <div className="p1g-modal-section">
              <div className="p1g-modal-label">Items Used</div>
              <div className="p1g-modal-items">
                {mission.usedItems.map((item, idx) => (
                  <div key={idx} className="p1g-modal-item-row">
                    <Package size={14} />
                    <span>
                      {item.name} x{item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mission.remarks && (
            <div className="p1g-modal-section">
              <div className="p1g-modal-label">Remarks</div>
              <div className="p1g-modal-remarks">{mission.remarks}</div>
            </div>
          )}

          <div className="p1g-modal-section">
            <div className="p1g-modal-label">Record Information</div>
            <div className="p1g-modal-meta">
              <div>Created: {formatDateTime(mission.createdAt)}</div>
              <div>Created by: {mission.createdBy || "—"}</div>
              {mission.updatedAt && (
                <div>Last updated: {formatDateTime(mission.updatedAt)}</div>
              )}
            </div>
          </div>
        </div>

        <div className="p1g-modal-foot">
          <div className="p1g-modal-actions">
            <button className="p1g-modal-btn ghost" onClick={onClose}>
              Close
            </button>
            <button className="p1g-modal-btn" onClick={() => onEdit(mission)}>
              <Edit size={16} /> Edit
            </button>
            <button
              className="p1g-modal-btn danger"
              onClick={() => onDelete(mission)}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== ADD/EDIT MISSION MODAL ==========
function MissionFormModal({ open, onClose, onSave, editing, barangays }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    barangay: "",
    activity: "Vaccination",
    status: "planned",
    animalsReached: 0,
    headsTreated: 0,
    team: [],
    usedItems: [],
    remarks: "",
  });

  const [teamInput, setTeamInput] = useState("");
  const [itemInput, setItemInput] = useState({
    name: "",
    quantity: 0,
    unit: "vials",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || "",
        description: editing.description || "",
        date: editing.date || new Date().toISOString().split("T")[0],
        barangay: editing.barangay || "",
        activity: editing.activity || "Vaccination",
        status: editing.status || "planned",
        animalsReached: editing.animalsReached || 0,
        headsTreated: editing.headsTreated || 0,
        team: editing.team || [],
        usedItems: editing.usedItems || [],
        remarks: editing.remarks || "",
      });
    } else {
      setForm({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        barangay: "",
        activity: "Vaccination",
        status: "planned",
        animalsReached: 0,
        headsTreated: 0,
        team: [],
        usedItems: [],
        remarks: "",
      });
    }
    setTeamInput("");
    setItemInput({ name: "", quantity: 0, unit: "vials" });
    setErr("");
  }, [editing, open]);

  if (!open) return null;

  const addTeamMember = () => {
    if (teamInput.trim()) {
      setForm((prev) => ({ ...prev, team: [...prev.team, teamInput.trim()] }));
      setTeamInput("");
    }
  };

  const removeTeamMember = (index) => {
    setForm((prev) => ({
      ...prev,
      team: prev.team.filter((_, i) => i !== index),
    }));
  };

  const addUsedItem = () => {
    if (itemInput.name.trim() && itemInput.quantity > 0) {
      setForm((prev) => ({
        ...prev,
        usedItems: [...prev.usedItems, { ...itemInput }],
      }));
      setItemInput({ name: "", quantity: 0, unit: "vials" });
    }
  };

  const removeUsedItem = (index) => {
    setForm((prev) => ({
      ...prev,
      usedItems: prev.usedItems.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (!form.title.trim()) return "Mission title is required.";
    if (!form.date) return "Date is required.";
    if (!form.barangay) return "Barangay is required.";
    if (!form.activity) return "Activity is required.";
    return "";
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) return setErr(v);

    setBusy(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setErr(e?.message || "Failed to save mission.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p1g-modal-wrap" role="dialog" aria-modal="true">
      <div className="p1g-modal-overlay" onClick={onClose} />
      <div className="p1g-modal-card p1g-modal-large">
        <div className="p1g-modal-head">
          <div>
            <div className="p1g-modal-title">
              {editing ? "Edit Mission" : "Add New Mission"}
            </div>
            <div className="p1g-modal-sub">
              Record field activities and outreach events
            </div>
          </div>
          <button className="p1g-modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="p1g-modal-body">
          {err && <div className="p1g-modal-error">{err}</div>}

          <div className="p1g-modal-form">
            <div className="p1g-modal-row">
              <label className="p1g-modal-label">
                Mission Title <span className="req">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g., Rabies Vaccination Drive - Poblacion"
                className="p1g-modal-input"
              />
            </div>

            <div className="p1g-modal-row">
              <label className="p1g-modal-label">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of the mission"
                className="p1g-modal-textarea"
              />
            </div>

            <div className="p1g-modal-grid2">
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">
                  Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="p1g-modal-input"
                />
              </div>
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">
                  Barangay <span className="req">*</span>
                </label>
                <select
                  value={form.barangay}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, barangay: e.target.value }))
                  }
                  className="p1g-modal-select"
                >
                  <option value="">Select barangay...</option>
                  {barangays.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p1g-modal-grid2">
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">
                  Activity <span className="req">*</span>
                </label>
                <select
                  value={form.activity}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, activity: e.target.value }))
                  }
                  className="p1g-modal-select"
                >
                  {ACTIVITY_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="p1g-modal-select"
                >
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="p1g-modal-grid2">
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">Animals Reached</label>
                <input
                  type="number"
                  min="0"
                  value={form.animalsReached}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      animalsReached: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="p1g-modal-input"
                />
              </div>
              <div className="p1g-modal-row">
                <label className="p1g-modal-label">Heads Treated</label>
                <input
                  type="number"
                  min="0"
                  value={form.headsTreated}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      headsTreated: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="p1g-modal-input"
                />
              </div>
            </div>

            <div className="p1g-modal-section">
              <label className="p1g-modal-label">Team Members</label>
              <div className="p1g-modal-team-input">
                <input
                  type="text"
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  placeholder="Enter team member name"
                  className="p1g-modal-input"
                  onKeyDown={(e) => e.key === "Enter" && addTeamMember()}
                />
                <button
                  className="p1g-modal-btn small"
                  onClick={addTeamMember}
                  type="button"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="p1g-modal-team-list">
                {form.team.map((member, idx) => (
                  <span key={idx} className="p1g-modal-team-tag">
                    {member}
                    <button onClick={() => removeTeamMember(idx)} type="button">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="p1g-modal-section">
              <label className="p1g-modal-label">Items Used</label>
              <div className="p1g-modal-items-input">
                <input
                  type="text"
                  value={itemInput.name}
                  onChange={(e) =>
                    setItemInput((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Item name"
                  className="p1g-modal-input"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemInput.quantity}
                  onChange={(e) =>
                    setItemInput((prev) => ({
                      ...prev,
                      quantity: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="Qty"
                  className="p1g-modal-input small"
                />
                <select
                  value={itemInput.unit}
                  onChange={(e) =>
                    setItemInput((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  className="p1g-modal-select small"
                >
                  <option value="vials">vials</option>
                  <option value="bottles">bottles</option>
                  <option value="doses">doses</option>
                  <option value="pcs">pcs</option>
                </select>
                <button
                  className="p1g-modal-btn small"
                  onClick={addUsedItem}
                  type="button"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="p1g-modal-items-list">
                {form.usedItems.map((item, idx) => (
                  <div key={idx} className="p1g-modal-item-tag">
                    <Package size={14} />
                    <span>
                      {item.name} x{item.quantity} {item.unit}
                    </span>
                    <button onClick={() => removeUsedItem(idx)} type="button">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p1g-modal-row">
              <label className="p1g-modal-label">Remarks</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Additional notes"
                className="p1g-modal-textarea"
              />
            </div>
          </div>
        </div>

        <div className="p1g-modal-foot">
          <div className="p1g-modal-actions">
            <button
              className="p1g-modal-btn ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="p1g-modal-btn primary"
              onClick={handleSubmit}
              disabled={busy}
            >
              {busy ? "Saving..." : editing ? "Save Changes" : "Create Mission"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== EXPORT MODAL (same style as Inventory) ==========
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
    missions: true,
    services: true,
    animals: false, // optional raw dump (big)
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
              Download GIS report with missions, services, and coverage summary
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
                    <span>Barangay Coverage Table</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.missions}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          missions: e.target.checked,
                        }))
                      }
                    />
                    <span>Missions (Field Activities)</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.services}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          services: e.target.checked,
                        }))
                      }
                    />
                    <span>Services (Routine)</span>
                  </label>

                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.animals}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          animals: e.target.checked,
                        }))
                      }
                    />
                    <span>Animals (Raw List - optional)</span>
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

  // init map once
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update view if center/zoom changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(center, zoom, { animate: true });
  }, [center, zoom]);

  // update overlays
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // clear markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // clear heat
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const isHeat = layer !== "markers";

    if (isHeat) {
      if (heatmapData?.length) {
        const pts = heatmapData.map((p) => [p.lat, p.lng, p.intensity]);
        // @ts-ignore
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

    // markers (Animals only)
    markers.forEach((marker) => {
      const customIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background:${marker.color};
          width:30px;height:30px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#fff;border:2px solid #fff;
          box-shadow:0 2px 4px rgba(0,0,0,.2);
          font-size:12px;font-weight:700;
        ">${marker.count}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const lm = L.marker([marker.lat, marker.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:220px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">${marker.barangay}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div>🐾 Animals: ${marker.animalCount}</div>
              <div>💉 Services: ${marker.serviceCount}</div>
              <div>📍 Missions: ${marker.missionCount}</div>
              <div>👥 Owners: ${marker.ownerCount}</div>
            </div>
            ${
              marker.lastActivity
                ? `<div style="margin-top:8px;font-size:11px;color:#666;">Last: ${formatDate(
                    marker.lastActivity
                  )}</div>`
                : ""
            }
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
      style={{ height: "420px", width: "100%", borderRadius: "8px" }}
    />
  );
}

export default function P1GIS() {
  const [animals, setAnimals] = useState([]);
  const [services, setServices] = useState([]);
  const [missions, setMissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState("markers");
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ missions: true });

  // map focus
  const [mapFocus, setMapFocus] = useState({ center: NAUJAN_CENTER, zoom: 11 });

  // modal state
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [missionDetailOpen, setMissionDetailOpen] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // ✅ EXPORT MODAL state like Inventory
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // =========================
  // LOAD DATA FROM FIRESTORE
  // =========================
  useEffect(() => {
    setLoading(true);
    setError("");

    const animalsQuery = query(
      collection(db, "program1_animals"),
      orderBy("createdAt", "desc")
    );

    const unsubAnimals = onSnapshot(
      animalsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAnimals(rows);
      },
      (err) => {
        console.error("Error loading animals:", err);
        setError("Failed to load animal data.");
      }
    );

    const servicesQuery = query(
      collection(db, "program1_routine_services"),
      orderBy("date", "desc")
    );

    const unsubServices = onSnapshot(
      servicesQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setServices(rows);
      },
      (err) => {
        console.error("Error loading services:", err);
      }
    );

    const missionsQuery = query(
      collection(db, "p1_gis_missions"),
      orderBy("date", "desc")
    );

    const unsubMissions = onSnapshot(
      missionsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMissions(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading missions:", err);
        setError("Failed to load mission data.");
        setLoading(false);
      }
    );

    return () => {
      unsubAnimals();
      unsubServices();
      unsubMissions();
    };
  }, []);

  // =========================
  // BARANGAY STATISTICS
  // =========================
  const barangayStats = useMemo(() => {
    const stats = {};

    BARANGAYS.forEach((b) => {
      stats[b] = {
        barangay: b,
        animalCount: 0,
        totalHeads: 0,
        registeredAnimals: 0,
        uniqueOwners: new Set(),
        serviceCount: 0,
        missionCount: 0,
        lastActivity: null,
        lastActivityMs: 0,
        coordinates: getBarangayCoordinates(b),
      };
    });

    animals.forEach((animal) => {
      const b = animal.barangay || animal.farmBarangay;
      if (b && stats[b]) {
        stats[b].animalCount++;
        stats[b].totalHeads += Number(animal.noOfHeads || 1);

        if (animal.ownerFirstName) {
          stats[b].uniqueOwners.add(
            `${animal.ownerFirstName} ${animal.ownerLastName || ""}`.trim()
          );
        }

        if (animal.animalRegistered === "Yes") {
          stats[b].registeredAnimals++;
        }
      }
    });

    services.forEach((service) => {
      const b = service.barangay;
      if (b && stats[b]) {
        stats[b].serviceCount++;
        const ms = toMillis(service.date);
        if (!stats[b].lastActivityMs || ms > stats[b].lastActivityMs) {
          stats[b].lastActivityMs = ms;
          stats[b].lastActivity = service.date;
        }
      }
    });

    missions.forEach((mission) => {
      const b = mission.barangay;
      if (b && stats[b]) {
        stats[b].missionCount++;
        const ms = toMillis(mission.date);
        if (!stats[b].lastActivityMs || ms > stats[b].lastActivityMs) {
          stats[b].lastActivityMs = ms;
          stats[b].lastActivity = mission.date;
        }
      }
    });

    Object.keys(stats).forEach((b) => {
      stats[b].uniqueOwnerCount = stats[b].uniqueOwners.size;
      delete stats[b].uniqueOwners;
      delete stats[b].lastActivityMs;
    });

    return stats;
  }, [animals, services, missions]);

  // =========================
  // OVERALL STATISTICS
  // =========================
  const totals = useMemo(() => {
    const totalAnimals = animals.length;
    const totalHeads = animals.reduce(
      (sum, a) => sum + (Number(a.noOfHeads) || 1),
      0
    );
    const totalServices = services.length;
    const totalMissions = missions.length;
    const activeBarangays = Object.values(barangayStats).filter(
      (b) => b.animalCount > 0 || b.serviceCount > 0 || b.missionCount > 0
    ).length;

    return {
      totalAnimals,
      totalHeads,
      totalServices,
      totalMissions,
      activeBarangays,
    };
  }, [animals, services, missions, barangayStats]);

  // =========================
  // LAYER HELPERS
  // =========================
  const layerLabel = useMemo(() => {
    if (layer === "services") return "Services";
    if (layer === "missions") return "Missions";
    return "Animals";
  }, [layer]);

  const isHeatLayer = layer !== "markers";

  const getLayerValue = (s) => {
    if (layer === "services") return s.serviceCount || 0;
    if (layer === "missions") return s.missionCount || 0;
    return s.animalCount || 0;
  };

  // =========================
  // MAP DATA
  // =========================
  const mapMarkers = useMemo(() => {
    const all = Object.values(barangayStats);
    const maxValue = Math.max(...all.map((s) => s.animalCount || 0), 1);

    return all
      .filter(
        (s) => s.animalCount > 0 || s.serviceCount > 0 || s.missionCount > 0
      )
      .map((s) => {
        const value = s.animalCount || 0;
        const intensity = value / maxValue;

        let color = "#3b82f6";
        if (intensity >= 0.75) color = "#ef4444";
        else if (intensity >= 0.5) color = "#f97316";
        else if (intensity >= 0.25) color = "#3b82f6";

        return {
          ...s,
          lat: s.coordinates[0],
          lng: s.coordinates[1],
          count: value,
          color,
          intensity,
          ownerCount: s.uniqueOwnerCount,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangayStats, layer]);

  // =========================
  // HEATMAP TABLE DATA
  // =========================
  const heatmapData = useMemo(() => {
    const all = Object.values(barangayStats);
    const maxValue = Math.max(...all.map(getLayerValue), 1);

    return BARANGAYS.map((barangay) => {
      const stats = barangayStats[barangay] || {
        animalCount: 0,
        serviceCount: 0,
        missionCount: 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangayStats, layer]);

  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return heatmapData;
    return heatmapData.filter((h) => h.barangay.toLowerCase().includes(n));
  }, [heatmapData, search]);

  // =========================
  // RECENT ACTIVITIES
  // =========================
  const recentActivities = useMemo(() => {
    const activities = [];

    services.slice(0, 10).forEach((s) => {
      activities.push({
        id: `service-${s.id}`,
        type: "service",
        date: s.date,
        barangay: s.barangay,
        title: `${s.activity || "Service"} - ${s.species || "Animal"}`,
        subtitle:
          `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Unknown owner",
        icon: <Stethoscope size={16} />,
      });
    });

    missions.slice(0, 10).forEach((m) => {
      activities.push({
        id: `mission-${m.id}`,
        type: "mission",
        date: m.date,
        barangay: m.barangay,
        title: m.title,
        subtitle: `${m.animalsReached || 0} animals reached`,
        icon: <Activity size={16} />,
      });
    });

    return activities
      .sort((a, b) => toMillis(b.date) - toMillis(a.date))
      .slice(0, 15);
  }, [services, missions]);

  // =========================
  // SELECTED BARANGAY DETAILS
  // =========================
  const selectedDetails = useMemo(() => {
    if (!selectedBarangay) return null;
    return barangayStats[selectedBarangay] || null;
  }, [selectedBarangay, barangayStats]);

  const barangayMissions = useMemo(() => {
    if (!selectedBarangay) return [];
    return missions.filter((m) => m.barangay === selectedBarangay).slice(0, 5);
  }, [missions, selectedBarangay]);

  // =========================
  // MISSION CRUD
  // =========================
  const saveMission = async (missionData) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");

    const payload = {
      ...missionData,
      animalsReached: Number(missionData.animalsReached) || 0,
      headsTreated: Number(missionData.headsTreated) || 0,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    };

    if (editingMission?.id) {
      await updateDoc(doc(db, "p1_gis_missions", editingMission.id), payload);
    } else {
      await addDoc(collection(db, "p1_gis_missions"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
    }
  };

  const deleteMissionConfirmed = async () => {
    if (!toDelete?.id) return;
    await deleteDoc(doc(db, "p1_gis_missions", toDelete.id));
    setMissionDetailOpen(false);
    setSelectedMission(null);
    setConfirmOpen(false);
    setToDelete(null);
  };

  // =========================
  // EXPORT HANDLER (same concept as Inventory)
  // =========================
  const handleExport = useCallback(
    async ({ format, dateRange, includeDetails }) => {
      const filteredServices = includeDetails.services
        ? services.filter((s) => inRange(s.date, dateRange.start, dateRange.end))
        : [];

      const filteredMissions = includeDetails.missions
        ? missions.filter((m) => inRange(m.date, dateRange.start, dateRange.end))
        : [];

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || auth.currentUser?.uid || "Unknown",
        dateRange,
        summary: includeDetails.summary
          ? {
              province: DEFAULT_PROVINCE,
              municipality: DEFAULT_MUNICIPALITY,
              totalAnimals: totals.totalAnimals,
              totalHeads: totals.totalHeads,
              totalServices: totals.totalServices,
              totalMissions: totals.totalMissions,
              activeBarangays: `${totals.activeBarangays}/${BARANGAYS.length}`,
              filteredServices: filteredServices.length,
              filteredMissions: filteredMissions.length,
            }
          : undefined,
        barangays: includeDetails.barangays
          ? BARANGAYS.map((b) => {
              const s = barangayStats[b] || {};
              const coords = getBarangayCoordinates(b);
              return {
                barangay: b,
                animals: s.animalCount || 0,
                heads: s.totalHeads || 0,
                registeredAnimals: s.registeredAnimals || 0,
                owners: s.uniqueOwnerCount || 0,
                services: s.serviceCount || 0,
                missions: s.missionCount || 0,
                lastActivity: s.lastActivity ? formatDate(s.lastActivity) : "",
                lat: coords[0],
                lng: coords[1],
              };
            })
          : undefined,
        services: includeDetails.services
          ? filteredServices.map((s) => ({
              id: s.id,
              date: s.date ? formatDate(s.date) : "",
              barangay: s.barangay || "",
              activity: s.activity || "",
              species: s.species || "",
              owner: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
              performedBy: s.performedBy || "",
              remarks: s.remarks || "",
            }))
          : undefined,
        missions: includeDetails.missions
          ? filteredMissions
              .slice()
              .sort((a, b) => toMillis(b.date) - toMillis(a.date))
              .map((m) => ({
                id: m.id,
                date: m.date ? formatDate(m.date) : "",
                title: m.title || "",
                barangay: m.barangay || "",
                activity: m.activity || "",
                status: m.status || "planned",
                animalsReached: Number(m.animalsReached) || 0,
                headsTreated: Number(m.headsTreated) || 0,
                team: Array.isArray(m.team) ? m.team.join(", ") : "",
                usedItems: Array.isArray(m.usedItems)
                  ? m.usedItems
                      .map((it) => `${it.name} x${it.quantity} ${it.unit}`)
                      .join("; ")
                  : "",
                remarks: m.remarks || "",
              }))
          : undefined,
        animals: includeDetails.animals
          ? animals.map((a) => ({
              id: a.id,
              barangay: a.barangay || a.farmBarangay || "",
              owner: `${a.ownerFirstName || ""} ${a.ownerLastName || ""}`.trim(),
              species: a.species || a.animalSpecies || "",
              heads: Number(a.noOfHeads || 1),
              registered: a.animalRegistered || "",
              createdAt: a.createdAt ? formatDateTime(a.createdAt) : "",
            }))
          : undefined,
      };

      // ===== JSON =====
      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gis_backup_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        return;
      }

      // ===== CSV =====
      if (format === "csv") {
        let csv = "GIS EXPORT REPORT\n";
        csv += `Exported: ${new Date().toLocaleString("en-PH")}\n`;
        csv += `Exported By: ${
          exportPayload.exportedBy || "Unknown"
        }\n`;
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
            "Barangay,Animals,Heads,RegisteredAnimals,Owners,Services,Missions,LastActivity,Lat,Lng\n";
          exportPayload.barangays.forEach((r) => {
            csv += `"${r.barangay}",${r.animals},${r.heads},${r.registeredAnimals},${r.owners},${r.services},${r.missions},"${r.lastActivity}",${r.lat},${r.lng}\n`;
          });
          csv += "\n";
        }

        if (includeDetails.services && exportPayload.services?.length) {
          csv += "SERVICES (Filtered)\n";
          csv += "Date,Barangay,Activity,Species,Owner,PerformedBy,Remarks\n";
          exportPayload.services.forEach((s) => {
            csv += `"${s.date}","${s.barangay}","${s.activity}","${s.species}","${s.owner}","${s.performedBy}","${(s.remarks || "").replaceAll('"', "'")}"\n`;
          });
          csv += "\n";
        }

        if (includeDetails.missions && exportPayload.missions?.length) {
          csv += "MISSIONS (Filtered)\n";
          csv +=
            "Date,Title,Barangay,Activity,Status,AnimalsReached,HeadsTreated,Team,UsedItems,Remarks\n";
          exportPayload.missions.forEach((m) => {
            csv += `"${m.date}","${(m.title || "").replaceAll('"', "'")}","${m.barangay}","${m.activity}","${m.status}",${m.animalsReached},${m.headsTreated},"${(m.team || "").replaceAll('"', "'")}","${(m.usedItems || "").replaceAll('"', "'")}","${(m.remarks || "").replaceAll('"', "'")}"\n`;
          });
          csv += "\n";
        }

        if (includeDetails.animals && exportPayload.animals?.length) {
          csv += "ANIMALS (Raw)\n";
          csv += "Barangay,Owner,Species,Heads,Registered,CreatedAt\n";
          exportPayload.animals.forEach((a) => {
            csv += `"${a.barangay}","${(a.owner || "").replaceAll('"', "'")}","${a.species}",${a.heads},"${a.registered}","${a.createdAt}"\n`;
          });
          csv += "\n";
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gis_export_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        return;
      }

      // ===== PDF =====
      if (format === "pdf") {
        const docPdf = new jsPDF({ orientation: "landscape" });
        const fileName = `gis_report_${DEFAULT_MUNICIPALITY}_${new Date()
          .toISOString()
          .split("T")[0]}.pdf`;

        // Header
        docPdf.setFontSize(14);
        docPdf.text(
          `GIS REPORT - ${DEFAULT_MUNICIPALITY}, ${DEFAULT_PROVINCE}`,
          14,
          14
        );

        docPdf.setFontSize(10);
        const meta = [
          `Exported: ${new Date().toLocaleString("en-PH")}`,
          `Exported By: ${exportPayload.exportedBy}`,
          `Date Range: ${dateRange.start} to ${dateRange.end}`,
          `Layer View: ${layerLabel} (${isHeatLayer ? "Heatmap" : "Markers"})`,
          `Search: ${search || "None"}`,
        ];
        let y = 22;
        meta.forEach((line) => {
          docPdf.text(line, 14, y);
          y += 5;
        });

        // Summary
        if (includeDetails.summary && exportPayload.summary) {
          autoTable(docPdf, {
            startY: y + 2,
            head: [["Metric", "Value"]],
            body: [
              ["Total Animals", String(totals.totalAnimals)],
              ["Total Heads", String(totals.totalHeads)],
              ["Total Services", String(totals.totalServices)],
              ["Total Missions", String(totals.totalMissions)],
              [
                "Active Barangays",
                `${totals.activeBarangays}/${BARANGAYS.length}`,
              ],
              ["Services (Filtered)", String(filteredServices.length)],
              ["Missions (Filtered)", String(filteredMissions.length)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });
          y = docPdf.lastAutoTable.finalY + 10;
        } else {
          y += 6;
        }

        const ensureSpace = (need = 25) => {
          const pageH = docPdf.internal.pageSize.getHeight();
          if (y + need > pageH - 10) {
            docPdf.addPage();
            y = 14;
          }
        };

        // Barangays
        if (includeDetails.barangays && exportPayload.barangays?.length) {
          ensureSpace(30);
          docPdf.setFontSize(12);
          docPdf.text("Barangay Coverage", 14, y);
          y += 4;

          const top = exportPayload.barangays
            .slice()
            .sort((a, b) => {
              const key =
                layer === "services"
                  ? "services"
                  : layer === "missions"
                  ? "missions"
                  : "animals";
              return (b[key] || 0) - (a[key] || 0);
            })
            .slice(0, 40);

          autoTable(docPdf, {
            startY: y,
            head: [[
              "Barangay",
              "Animals",
              "Heads",
              "Owners",
              "Services",
              "Missions",
              "Last Activity",
            ]],
            body: top.map((r) => [
              r.barangay,
              String(r.animals),
              String(r.heads),
              String(r.owners),
              String(r.services),
              String(r.missions),
              r.lastActivity || "",
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 14, right: 14 },
          });

          y = docPdf.lastAutoTable.finalY + 10;
        }

        // Services
        if (includeDetails.services && exportPayload.services?.length) {
          ensureSpace(30);
          docPdf.setFontSize(12);
          docPdf.text("Services (Filtered)", 14, y);
          y += 4;

          autoTable(docPdf, {
            startY: y,
            head: [["Date", "Barangay", "Activity", "Species", "Owner", "Performed By"]],
            body: exportPayload.services.slice(0, 50).map((s) => [
              s.date,
              s.barangay,
              s.activity,
              s.species,
              s.owner,
              s.performedBy,
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = docPdf.lastAutoTable.finalY + 10;
        }

        // Missions
        if (includeDetails.missions && exportPayload.missions?.length) {
          ensureSpace(30);
          docPdf.setFontSize(12);
          docPdf.text("Missions (Filtered)", 14, y);
          y += 4;

          autoTable(docPdf, {
            startY: y,
            head: [["Date", "Title", "Barangay", "Activity", "Status", "Animals"]],
            body: exportPayload.missions.slice(0, 60).map((m) => [
              m.date,
              m.title,
              m.barangay,
              m.activity,
              m.status,
              String(m.animalsReached),
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fontStyle: "bold" },
            theme: "grid",
            margin: { left: 10, right: 10 },
          });

          y = docPdf.lastAutoTable.finalY + 10;
        }

        // Footer page numbers
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

      // ===== XLSX (ExcelJS) =====
      if (format === "xlsx") {
        const wb = new ExcelJS.Workbook();
        wb.creator = "ANIMIS";
        wb.created = new Date();

        // Summary sheet
        if (includeDetails.summary) {
          const ws = wb.addWorksheet("Summary");
          ws.addRow(["Province", DEFAULT_PROVINCE]);
          ws.addRow(["Municipality", DEFAULT_MUNICIPALITY]);
          ws.addRow(["Exported At", new Date().toLocaleString("en-PH")]);
          ws.addRow(["Exported By", exportPayload.exportedBy]);
          ws.addRow(["Date Range", `${dateRange.start} to ${dateRange.end}`]);
          ws.addRow([]);
          ws.addRow(["Total Animals", totals.totalAnimals]);
          ws.addRow(["Total Heads", totals.totalHeads]);
          ws.addRow(["Total Services", totals.totalServices]);
          ws.addRow(["Total Missions", totals.totalMissions]);
          ws.addRow([
            "Active Barangays",
            `${totals.activeBarangays}/${BARANGAYS.length}`,
          ]);
          ws.addRow([]);
          ws.addRow(["Services (Filtered)", filteredServices.length]);
          ws.addRow(["Missions (Filtered)", filteredMissions.length]);

          ws.columns = [{ width: 24 }, { width: 42 }];
        }

        // Barangays sheet
        if (includeDetails.barangays) {
          const wsB = wb.addWorksheet("Barangays");
          wsB.columns = [
            { header: "Barangay", key: "barangay", width: 22 },
            { header: "Animals", key: "animals", width: 10 },
            { header: "Heads", key: "heads", width: 10 },
            { header: "Registered Animals", key: "registeredAnimals", width: 18 },
            { header: "Owners", key: "owners", width: 10 },
            { header: "Services", key: "services", width: 10 },
            { header: "Missions", key: "missions", width: 10 },
            { header: "Last Activity", key: "lastActivity", width: 16 },
            { header: "Lat", key: "lat", width: 12 },
            { header: "Lng", key: "lng", width: 12 },
          ];
          wsB.getRow(1).font = { bold: true };

          (exportPayload.barangays || []).forEach((r) => wsB.addRow(r));
        }

        // Services sheet
        if (includeDetails.services) {
          const wsS = wb.addWorksheet("Services");
          wsS.columns = [
            { header: "Date", key: "date", width: 14 },
            { header: "Barangay", key: "barangay", width: 18 },
            { header: "Activity", key: "activity", width: 18 },
            { header: "Species", key: "species", width: 14 },
            { header: "Owner", key: "owner", width: 22 },
            { header: "Performed By", key: "performedBy", width: 18 },
            { header: "Remarks", key: "remarks", width: 26 },
          ];
          wsS.getRow(1).font = { bold: true };

          (exportPayload.services || []).forEach((s) => wsS.addRow(s));
        }

        // Missions sheet
        if (includeDetails.missions) {
          const wsM = wb.addWorksheet("Missions");
          wsM.columns = [
            { header: "Date", key: "date", width: 14 },
            { header: "Title", key: "title", width: 30 },
            { header: "Barangay", key: "barangay", width: 18 },
            { header: "Activity", key: "activity", width: 18 },
            { header: "Status", key: "status", width: 12 },
            { header: "Animals Reached", key: "animalsReached", width: 16 },
            { header: "Heads Treated", key: "headsTreated", width: 14 },
            { header: "Team", key: "team", width: 26 },
            { header: "Items Used", key: "usedItems", width: 30 },
            { header: "Remarks", key: "remarks", width: 24 },
          ];
          wsM.getRow(1).font = { bold: true };

          (exportPayload.missions || []).forEach((m) => wsM.addRow(m));
        }

        // Animals sheet (optional)
        if (includeDetails.animals) {
          const wsA = wb.addWorksheet("Animals");
          wsA.columns = [
            { header: "Barangay", key: "barangay", width: 18 },
            { header: "Owner", key: "owner", width: 22 },
            { header: "Species", key: "species", width: 14 },
            { header: "Heads", key: "heads", width: 10 },
            { header: "Registered", key: "registered", width: 12 },
            { header: "Created At", key: "createdAt", width: 20 },
          ];
          wsA.getRow(1).font = { bold: true };
          (exportPayload.animals || []).forEach((a) => wsA.addRow(a));
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(
          new Blob([buf], {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          `GIS_${DEFAULT_MUNICIPALITY}_${new Date()
            .toISOString()
            .split("T")[0]}.xlsx`
        );
      }
    },
    [
      animals,
      services,
      missions,
      totals,
      barangayStats,
      layer,
      layerLabel,
      isHeatLayer,
      search,
    ]
  );

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

  if (loading) {
    return (
      <div className="p1g-page p1-fontPro">
        <div className="p1g-loading">
          <MapPinned size={40} />
          <div>Loading GIS data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p1g-page p1-fontPro">
      {/* Header */}
      <div className="p1g-head">
        <div className="p1g-titleBlock">
          <div className="p1g-h1">GIS Mapping</div>
          <div className="p1g-sub">
            Real-time distribution and coverage in {DEFAULT_MUNICIPALITY}
          </div>
        </div>

        {/* ✅ SAME STYLE AS INVENTORY: Download + Print + Add */}
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

          <button
            className="p1g-primary"
            onClick={() => {
              setEditingMission(null);
              setMissionModalOpen(true);
            }}
            type="button"
          >
            <Plus size={18} /> Add Mission
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
          <div className="p1g-statK">Total Animals</div>
          <div className="p1g-statV">{formatNumber(totals.totalAnimals)}</div>
          <div className="p1g-statS">{totals.totalHeads} heads</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">Services</div>
          <div className="p1g-statV">{formatNumber(totals.totalServices)}</div>
          <div className="p1g-statS">Routine activities</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">Missions</div>
          <div className="p1g-statV">{formatNumber(totals.totalMissions)}</div>
          <div className="p1g-statS">Field activities</div>
        </div>
        <div className="p1g-stat">
          <div className="p1g-statK">Coverage</div>
          <div className="p1g-statV">
            {totals.activeBarangays}/{BARANGAYS.length}
          </div>
          <div className="p1g-statS">Active barangays</div>
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
            <option value="markers">Animals (Markers)</option>
            <option value="heatmap">Animals (Heatmap)</option>
            <option value="services">Services (Heatmap)</option>
            <option value="missions">Missions (Heatmap)</option>
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
                      title={`${layerLabel} count`}
                    >
                      {item.heatValue}
                    </span>

                    <div className="p1g-heatmap-stats">
                      <span title="Animals">{item.animalCount} 🐾</span>
                      <span title="Services">{item.serviceCount} 💉</span>
                      <span title="Missions">{item.missionCount} 📍</span>
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
                  <PawPrint size={16} />
                  <div>
                    <div className="p1g-detail-label">Animals</div>
                    <div className="p1g-detail-value">
                      {selectedDetails.animalCount}
                      <span className="p1g-detail-sub">
                        ({selectedDetails.totalHeads} heads)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <User size={16} />
                  <div>
                    <div className="p1g-detail-label">Owners</div>
                    <div className="p1g-detail-value">
                      {selectedDetails.uniqueOwnerCount}
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <Stethoscope size={16} />
                  <div>
                    <div className="p1g-detail-label">Services</div>
                    <div className="p1g-detail-value">
                      {selectedDetails.serviceCount}
                    </div>
                  </div>
                </div>
                <div className="p1g-detail-item">
                  <Activity size={16} />
                  <div>
                    <div className="p1g-detail-label">Missions</div>
                    <div className="p1g-detail-value">
                      {selectedDetails.missionCount}
                    </div>
                  </div>
                </div>
              </div>

              {selectedDetails.animalCount > 0 &&
                selectedDetails.registeredAnimals > 0 && (
                  <div className="p1g-details-section">
                    <div className="p1g-coverage-bar">
                      <div
                        className="p1g-coverage-fill"
                        style={{
                          width: `${
                            (selectedDetails.registeredAnimals /
                              selectedDetails.animalCount) *
                            100
                          }%`,
                        }}
                      />
                      <span className="p1g-coverage-text">
                        {Math.round(
                          (selectedDetails.registeredAnimals /
                            selectedDetails.animalCount) *
                            100
                        )}
                        % registered
                      </span>
                    </div>
                  </div>
                )}

              {barangayMissions.length > 0 && (
                <div className="p1g-details-section">
                  <div className="p1g-details-section-title">
                    Recent Missions
                    <span className="p1g-section-badge">
                      {barangayMissions.length}
                    </span>
                  </div>
                  {barangayMissions.map((mission) => (
                    <div
                      key={mission.id}
                      className="p1g-mission-item"
                      onClick={() => {
                        setSelectedMission(mission);
                        setMissionDetailOpen(true);
                      }}
                    >
                      <div className="p1g-mission-title">{mission.title}</div>
                      <div className="p1g-mission-meta">
                        <span>{formatDate(mission.date)}</span>
                        <span>•</span>
                        <span>{mission.animalsReached || 0} animals</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDetails.lastActivity && (
                <div className="p1g-details-footer">
                  <span>
                    Last activity: {formatDate(selectedDetails.lastActivity)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="p1g-card">
        <div className="p1g-cardTitle">
          <Activity size={18} /> Recent Activities
        </div>

        <div className="p1g-activity-list">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="p1g-activity-item">
              <div className="p1g-activity-icon">{activity.icon}</div>
              <div className="p1g-activity-content">
                <div className="p1g-activity-title">{activity.title}</div>
                <div className="p1g-activity-meta">
                  <span>{activity.barangay}</span>
                  <span>•</span>
                  <span>{formatDate(activity.date)}</span>
                </div>
                <div className="p1g-activity-subtitle">{activity.subtitle}</div>
              </div>
            </div>
          ))}

          {recentActivities.length === 0 && (
            <div className="p1g-empty">No recent activities</div>
          )}
        </div>
      </div>

      {/* Missions Table */}
      <div className="p1g-card">
        <div
          className="p1g-cardTitle"
          style={{ cursor: "pointer" }}
          onClick={() => toggleSection("missions")}
        >
          <Activity size={18} /> Field Missions
          <span className="p1g-cardBadge">{missions.length} total</span>
          <button className="p1g-expand-btn" type="button">
            {expandedSections.missions ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
        </div>

        {expandedSections.missions && (
          <div className="p1g-missions-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Barangay</th>
                  <th>Activity</th>
                  <th>Animals</th>
                  <th>Status</th>
                  <th className="p1g-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((mission) => (
                  <tr key={mission.id} className="p1g-mission-row">
                    <td>{formatDate(mission.date)}</td>
                    <td className="p1g-mission-title-cell">{mission.title}</td>
                    <td>{mission.barangay}</td>
                    <td>{mission.activity}</td>
                    <td>{formatNumber(mission.animalsReached || 0)}</td>
                    <td>
                      <span
                        className={`p1g-status-badge ${
                          mission.status || "planned"
                        }`}
                      >
                        {mission.status || "planned"}
                      </span>
                    </td>
                    <td>
                      <div className="p1g-row-actions">
                        <button
                          className="p1g-iconBtn small"
                          onClick={() => {
                            setSelectedMission(mission);
                            setMissionDetailOpen(true);
                          }}
                          type="button"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="p1g-iconBtn small"
                          onClick={() => {
                            setEditingMission(mission);
                            setMissionModalOpen(true);
                          }}
                          type="button"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="p1g-iconBtn small danger"
                          onClick={() => {
                            setToDelete(mission);
                            setConfirmOpen(true);
                          }}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {missions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p1g-empty">
                      No missions recorded. Click "Add Mission" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <MissionFormModal
        open={missionModalOpen}
        onClose={() => {
          setMissionModalOpen(false);
          setEditingMission(null);
        }}
        onSave={saveMission}
        editing={editingMission}
        barangays={BARANGAYS}
      />

      <MissionDetailModal
        open={missionDetailOpen}
        onClose={() => {
          setMissionDetailOpen(false);
          setSelectedMission(null);
        }}
        mission={selectedMission}
        onEdit={(mission) => {
          setMissionDetailOpen(false);
          setEditingMission(mission);
          setMissionModalOpen(true);
        }}
        onDelete={(mission) => {
          setMissionDetailOpen(false);
          setToDelete(mission);
          setConfirmOpen(true);
        }}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Delete Mission?"
        message={`Are you sure you want to delete "${
          toDelete?.title || "this mission"
        }"?`}
        dangerText="Delete"
        onCancel={() => {
          setConfirmOpen(false);
          setToDelete(null);
        }}
        onConfirm={deleteMissionConfirmed}
      />

      {/* ✅ EXPORT MODAL (same layout like Inventory) */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}