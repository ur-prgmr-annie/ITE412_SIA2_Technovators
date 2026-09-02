// src/pages/program1/P1Farmers.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import "../../styles/p1Registration.css";
import { auth, db } from "../../services/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Plus,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  Printer,
  RefreshCw,
  AlertTriangle,
  User,
  MapPin,
  Home,
  Download,
  FileText,
  Filter,
} from "lucide-react";

const COL_NAME = "program1_farmers";

/** Fixed location defaults */
const DEFAULT_PROVINCE = "Oriental Mindoro";
const DEFAULT_MUNICIPALITY = "Naujan";

/** Complete BARANGAYS (same as animal registration) */
const BARANGAYS = [
  "Adrialuna",
  "Andres Ilagan",
  "Antipolo",
  "Apitong",
  "Arangin",
  "Aurora",
  "Bacungan",
  "Bagong Buhay",
  "Balite",
  "Bancuro",
  "Banuton",
  "Barcenaga",
  "Bayani",
  "Buhangin",
  "Caburo",
  "Concepcion",
  "Dao",
  "Del Pilar",
  "Estrella",
  "Evangelista",
  "Gamao",
  "General Esco",
  "Herrera",
  "Inarawan",
  "Kalinisan",
  "Laguna",
  "Mabini",
  "Magtibay",
  "Mahabang Parang",
  "Malaya",
  "Malinao",
  "Malvar",
  "Masagana",
  "Masaguing",
  "Melgar A",
  "Melgar B",
  "Metolza",
  "Montelago",
  "Montemayor",
  "Motoderazo",
  "Mulawin",
  "Nag-iba I",
  "Nag-iba II",
  "Pagkakaisa",
  "Pagsabangan",
  "Paitan",
  "Palhi",
  "Paniquian",
  "Pinagsabangan I",
  "Pinagsabangan II",
  "Piñahan",
  "Poblacion I",
  "Poblacion II",
  "Poblacion III",
  "Sampaguita",
  "San Agustín I",
  "San Agustín II",
  "San Andres",
  "San Antonio",
  "San Carlos",
  "San Isidro",
  "San Jose",
  "San Luis",
  "San Nicolas",
  "San Pedro",
  "Santa Cruz",
  "Santa Isabel",
  "Santa Maria",
  "Santiago",
  "Santo Niño",
  "Tagumpay",
  "Tigkan",
  "Tongyan"
];

const SORTED_BARANGAYS = [...BARANGAYS].sort((a, b) => a.localeCompare(b));

const GENDER_OPTIONS = ["Male", "Female"];
const YESNO_OPTIONS = ["Yes", "No"];

/** Export formats */
const EXPORT_FORMATS = [
  { value: "csv", label: "CSV (Excel)" },
  { value: "pdf", label: "PDF Report" },
  { value: "json", label: "JSON (Backup)" },
];

const emptyForm = () => ({
  province: DEFAULT_PROVINCE,
  municipality: DEFAULT_MUNICIPALITY,
  barangay: "",

  // Farmer details
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  birthday: "",
  contact: "",

  // Farm details (optional)
  farmName: "",
  farmType: "", // e.g., "Crop", "Livestock", "Mixed"
  farmSize: "", // e.g., in hectares
  livestockCount: 0,
  remarks: "",
});

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return d;
  }
}

function formatDateTime(date) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return date;
  }
}

/* ===== Export Modal (identical to animal registration) ===== */
function ExportModal({ open, onClose, onExport }) {
  const [exportFormat, setExportFormat] = useState("csv");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [includeDetails, setIncludeDetails] = useState({
    farmerInfo: true,
    addressInfo: true,
    farmInfo: true,
    summary: true,
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
            <div className="p1m2-title">Export Registered Farmers</div>
            <div className="p1m2-sub">Download complete farmer list</div>
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
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                  {EXPORT_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="p1m2-2">
                <div className="p1m2-row">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(d => ({ ...d, start: e.target.value }))}
                  />
                </div>
                <div className="p1m2-row">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(d => ({ ...d, end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="p1m2-row">
                <label>Include in Export</label>
                <div className="p1m2-checkbox-group">
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.farmerInfo}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, farmerInfo: e.target.checked }))}
                    />
                    <span>Farmer Information</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.addressInfo}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, addressInfo: e.target.checked }))}
                    />
                    <span>Address Details</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.farmInfo}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, farmInfo: e.target.checked }))}
                    />
                    <span>Farm Information</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.summary}
                      onChange={(e) => setIncludeDetails(d => ({ ...d, summary: e.target.checked }))}
                    />
                    <span>Summary Statistics</span>
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
            <button className="p1m2-btn ghost" onClick={onClose} disabled={busy}>
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

/* ===== Modal Shell ===== */
function ModalShell({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="p1m-wrap" role="dialog" aria-modal="true">
      <button className="p1m-overlay" onClick={onClose} aria-label="Close modal" />
      <div className="p1m-card">
        <div className="p1m2">
          <div className="p1m2-head">
            <div>
              <div className="p1m2-titleRow">
                <div className="p1m2-title">{title}</div>
              </div>
              <div className="p1m2-sub">
                Farmer Registration • Province & Municipality fixed (Oriental Mindoro • Naujan)
              </div>
            </div>
            <button className="p1m2-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="p1m2-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Confirm Modal ===== */
function ConfirmModal({ open, title, message, onCancel, onConfirm, busy }) {
  if (!open) return null;
  return (
    <div className="p1c-wrap" role="dialog" aria-modal="true">
      <button className="p1c-overlay" onClick={busy ? undefined : onCancel} aria-label="Close" />
      <div className="p1c-card">
        <div className="p1c-head">
          <div className="p1c-titleRow">
            <AlertTriangle size={18} />
            <div className="p1c-title">{title}</div>
          </div>
          <button className="p1c-x" onClick={onCancel} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p1c-body">
          <div className="p1c-msg">{message}</div>
          <div className="p1c-actions">
            <button className="p1c-btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="p1c-btn danger" onClick={onConfirm} disabled={busy}>
              {busy ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function P1Farmers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [busySave, setBusySave] = useState(false);
  const [inlineErr, setInlineErr] = useState("");
  const [inlineMsg, setInlineMsg] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState(null);
  const [busyDel, setBusyDel] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Real-time listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, COL_NAME), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        setRows(out);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const barangayOptions = useMemo(() => SORTED_BARANGAYS, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesBarangay = barangayFilter ? (r.barangay || "") === barangayFilter : true;
      if (!matchesBarangay) return false;

      if (!s) return true;
      const hay = [
        r.barangay,
        r.firstName,
        r.lastName,
        r.contact,
        r.farmName,
        r.farmType,
        r.remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [rows, search, barangayFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const byBarangay = {};
    const byGender = {};
    rows.forEach(r => {
      const barangay = r.barangay || "Unknown";
      byBarangay[barangay] = (byBarangay[barangay] || 0) + 1;
      const gender = r.gender || "Unknown";
      byGender[gender] = (byGender[gender] || 0) + 1;
    });
    return { total, byBarangay, byGender };
  }, [rows]);

  // CRUD
  const openAdd = () => {
    setInlineErr("");
    setInlineMsg("");
    setEditingId(null);
    setForm(emptyForm());
    setOpenForm(true);
  };

  const openEdit = (row) => {
    setInlineErr("");
    setInlineMsg("");
    setEditingId(row.id);
    setForm({
      province: row.province || DEFAULT_PROVINCE,
      municipality: row.municipality || DEFAULT_MUNICIPALITY,
      barangay: row.barangay || "",
      firstName: row.firstName || "",
      middleName: row.middleName || "",
      lastName: row.lastName || "",
      gender: row.gender || "",
      birthday: row.birthday || "",
      contact: row.contact || "",
      farmName: row.farmName || "",
      farmType: row.farmType || "",
      farmSize: row.farmSize || "",
      livestockCount: row.livestockCount ?? 0,
      remarks: row.remarks || "",
    });
    setOpenForm(true);
  };

  const openView = (row) => {
    setViewRow(row);
    setViewOpen(true);
  };

  const requestDelete = (id) => {
    setDelId(id);
    setDelOpen(true);
  };

  const validate = () => {
    if (!form.barangay) return "Barangay is required.";
    if (!form.firstName.trim()) return "First Name is required.";
    if (!form.lastName.trim()) return "Last Name is required.";
    if (!form.contact.trim()) return "Contact number is required.";
    return "";
  };

  const save = async () => {
    setInlineErr("");
    setInlineMsg("");

    const v = validate();
    if (v) return setInlineErr(v);

    const user = auth.currentUser;
    if (!user) return setInlineErr("No active session. Please sign in again.");

    setBusySave(true);
    try {
      const payload = {
        ...form,
        province: DEFAULT_PROVINCE,
        municipality: DEFAULT_MUNICIPALITY,
        livestockCount: Number(form.livestockCount || 0),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      if (editingId) {
        await updateDoc(doc(db, COL_NAME, editingId), payload);
        setInlineMsg("Farmer record updated successfully.");
      } else {
        await addDoc(collection(db, COL_NAME), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
        setInlineMsg("Farmer record saved successfully.");
      }

      setTimeout(() => {
        setOpenForm(false);
        setEditingId(null);
        setForm(emptyForm());
        setInlineErr("");
        setInlineMsg("");
      }, 300);
    } catch (e) {
      console.error(e);
      setInlineErr("Failed to save. Please check Firestore rules and try again.");
    } finally {
      setBusySave(false);
    }
  };

  const confirmDelete = async () => {
    if (!delId) return;
    setBusyDel(true);
    try {
      await deleteDoc(doc(db, COL_NAME, delId));
      setDelOpen(false);
      setDelId(null);
    } finally {
      setBusyDel(false);
    }
  };

  // Export function (similar to animal version)
  const handleExport = useCallback(async ({ format, dateRange, includeDetails }) => {
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);

      const filteredRows = rows.filter(r => {
        const createdDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
        return createdDate >= startDate && createdDate <= endDate;
      });

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || "Unknown",
        dateRange,
        municipality: DEFAULT_MUNICIPALITY,
        province: DEFAULT_PROVINCE,
        filters: {
          barangay: barangayFilter || "All",
          search: search || "None",
        },
        summary: {
          totalRecords: filteredRows.length,
          byBarangay: {},
          byGender: {},
        },
      };

      filteredRows.forEach(r => {
        const barangay = r.barangay || "Unknown";
        exportData.summary.byBarangay[barangay] = (exportData.summary.byBarangay[barangay] || 0) + 1;
        const gender = r.gender || "Unknown";
        exportData.summary.byGender[gender] = (exportData.summary.byGender[gender] || 0) + 1;
      });

      exportData.records = filteredRows.map(row => {
        const record = {};
        if (includeDetails.farmerInfo) {
          record.farmer = {
            firstName: row.firstName || "",
            middleName: row.middleName || "",
            lastName: row.lastName || "",
            fullName: `${row.firstName || ""} ${row.lastName || ""}`.trim(),
            gender: row.gender || "",
            birthday: row.birthday || "",
            contact: row.contact || "",
          };
        }
        if (includeDetails.addressInfo) {
          record.address = {
            province: row.province || DEFAULT_PROVINCE,
            municipality: row.municipality || DEFAULT_MUNICIPALITY,
            barangay: row.barangay || "",
          };
        }
        if (includeDetails.farmInfo) {
          record.farm = {
            farmName: row.farmName || "",
            farmType: row.farmType || "",
            farmSize: row.farmSize || "",
            livestockCount: Number(row.livestockCount) || 0,
          };
        }
        record.metadata = {
          createdAt: row.createdAt?.toDate ? row.createdAt.toDate() : row.createdAt,
          updatedAt: row.updatedAt?.toDate ? row.updatedAt.toDate() : row.updatedAt,
          id: row.id,
        };
        return record;
      });

      if (format === "csv") {
        let csv = "NAUJAN FARMER DATABASE\n";
        csv += `Municipality: ${DEFAULT_MUNICIPALITY}, Province: ${DEFAULT_PROVINCE}\n`;
        csv += `Exported: ${new Date().toLocaleString()}\n`;
        csv += `Exported By: ${auth.currentUser?.email || 'Unknown'}\n`;
        csv += `Date Range: ${dateRange.start} to ${dateRange.end}\n`;
        csv += `Filters: Barangay=${barangayFilter || 'All'}\n\n`;

        if (includeDetails.summary) {
          csv += "SUMMARY STATISTICS\n";
          csv += `Total Records,${exportData.summary.totalRecords}\n\n`;
          csv += "BREAKDOWN BY BARANGAY\n";
          csv += "Barangay,Count\n";
          Object.entries(exportData.summary.byBarangay)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([barangay, count]) => {
              csv += `${barangay},${count}\n`;
            });
          csv += "\nBREAKDOWN BY GENDER\n";
          csv += "Gender,Count\n";
          Object.entries(exportData.summary.byGender)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([gender, count]) => {
              csv += `${gender},${count}\n`;
            });
          csv += "\n";
        }

        let headers = [];
        if (includeDetails.farmerInfo) {
          headers.push("First Name", "Middle Name", "Last Name", "Gender", "Birthday", "Contact");
        }
        if (includeDetails.addressInfo) {
          headers.push("Province", "Municipality", "Barangay");
        }
        if (includeDetails.farmInfo) {
          headers.push("Farm Name", "Farm Type", "Farm Size (ha)", "Livestock Count");
        }
        headers.push("Created Date", "Last Updated", "Record ID");
        csv += headers.join(",") + "\n";

        exportData.records.forEach(record => {
          let row = [];
          if (includeDetails.farmerInfo) {
            row.push(
              `"${record.farmer.firstName}"`,
              `"${record.farmer.middleName}"`,
              `"${record.farmer.lastName}"`,
              record.farmer.gender,
              record.farmer.birthday,
              `"${record.farmer.contact}"`
            );
          }
          if (includeDetails.addressInfo) {
            row.push(record.address.province, record.address.municipality, record.address.barangay);
          }
          if (includeDetails.farmInfo) {
            row.push(
              `"${record.farm.farmName}"`,
              `"${record.farm.farmType}"`,
              record.farm.farmSize,
              record.farm.livestockCount
            );
          }
          row.push(
            record.metadata.createdAt ? formatDateTime(record.metadata.createdAt) : "",
            record.metadata.updatedAt ? formatDateTime(record.metadata.updatedAt) : "",
            record.metadata.id
          );
          csv += row.join(",") + "\n";
        });

        csv += `\nTotal Records,${exportData.records.length}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Naujan_Farmers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        const willHaveManyCols =
          includeDetails.farmerInfo + includeDetails.addressInfo + includeDetails.farmInfo >= 2;
        const doc = new jsPDF({ orientation: willHaveManyCols ? "landscape" : "portrait" });
        const fileName = `Naujan_Farmers_${new Date().toISOString().split('T')[0]}.pdf`;

        doc.setFontSize(14);
        doc.text("FARMER REGISTRATION REPORT", 14, 15);
        doc.setFontSize(10);
        const metaLines = [
          `Province: ${DEFAULT_PROVINCE}`,
          `Municipality: ${DEFAULT_MUNICIPALITY}`,
          `Exported: ${new Date().toLocaleString("en-PH")}`,
          `Exported By: ${auth.currentUser?.email || "Unknown"}`,
          `Date Range: ${dateRange.start} to ${dateRange.end}`,
          `Filters: Barangay=${barangayFilter || "All"}`,
          `Total Records: ${filteredRows.length}`,
        ];
        let y = 22;
        metaLines.forEach((line) => { doc.text(line, 14, y); y += 5; });

        if (includeDetails.summary) {
          const summaryStartY = y + 4;
          autoTable(doc, {
            startY: summaryStartY,
            head: [["Summary", "Value"]],
            body: [
              ["Total Records", String(exportData.summary.totalRecords)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fontStyle: "bold" },
          });
          let nextY = doc.lastAutoTable.finalY + 6;

          const byBarangayRows = Object.entries(exportData.summary.byBarangay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, String(v)]);
          if (byBarangayRows.length) {
            autoTable(doc, {
              startY: nextY,
              head: [["Breakdown by Barangay", "Count"]],
              body: byBarangayRows,
              styles: { fontSize: 9 },
              headStyles: { fontStyle: "bold" },
            });
            nextY = doc.lastAutoTable.finalY + 6;
          }

          const byGenderRows = Object.entries(exportData.summary.byGender)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, String(v)]);
          if (byGenderRows.length) {
            autoTable(doc, {
              startY: nextY,
              head: [["Breakdown by Gender", "Count"]],
              body: byGenderRows,
              styles: { fontSize: 9 },
              headStyles: { fontStyle: "bold" },
            });
            nextY = doc.lastAutoTable.finalY + 8;
          }
          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 10;
        } else {
          y += 6;
        }

        const head = [];
        const colKeys = [];
        if (includeDetails.farmerInfo) {
          head.push("Farmer", "Contact", "Gender", "Birthday");
          colKeys.push("fullName", "contact", "gender", "birthday");
        }
        if (includeDetails.addressInfo) {
          head.push("Barangay", "Province", "Municipality");
          colKeys.push("barangay", "province", "municipality");
        }
        if (includeDetails.farmInfo) {
          head.push("Farm Name", "Farm Type", "Size (ha)", "Livestock");
          colKeys.push("farmName", "farmType", "farmSize", "livestockCount");
        }
        head.push("Created", "Updated");
        colKeys.push("createdAt", "updatedAt");

        const body = filteredRows.map((r) => {
          const obj = {
            fullName: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
            contact: r.contact || "",
            gender: r.gender || "",
            birthday: r.birthday || "",
            barangay: r.barangay || "",
            province: r.province || DEFAULT_PROVINCE,
            municipality: r.municipality || DEFAULT_MUNICIPALITY,
            farmName: r.farmName || "",
            farmType: r.farmType || "",
            farmSize: r.farmSize || "",
            livestockCount: String(Number(r.livestockCount) || 0),
            createdAt: r.createdAt?.toDate ? formatDateTime(r.createdAt.toDate()) : "",
            updatedAt: r.updatedAt?.toDate ? formatDateTime(r.updatedAt.toDate()) : "",
          };
          return colKeys.map((k) => obj[k] ?? "");
        });

        autoTable(doc, {
          startY: y,
          head: [head],
          body,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fontStyle: "bold" },
          theme: "grid",
          margin: { left: 10, right: 10 },
        });
        doc.save(fileName);
      } else if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Naujan_Farmers_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      alert(`✅ Export successful!\n\n${filteredRows.length} records exported as ${format.toUpperCase()}`);
    } catch (e) {
      console.error("Export failed:", e);
      alert(`❌ Export failed: ${e.message}`);
    }
  }, [rows, barangayFilter, search]);

  const setF = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="p1r-page p1-fontPro">
      <div className="p1r-shell">
        {/* HEADER */}
        <div className="p1r-top">
          <div>
            <div className="p1r-h1">Farmer Registration</div>
            <div className="p1r-sub">
              Municipality of Naujan • Oriental Mindoro • Complete Barangay List
            </div>
          </div>

          <div className="p1r-topActions">
            <button 
              className="p1r-iconBtn" 
              onClick={() => setExportModalOpen(true)} 
              title="Export Data"
            >
              <Download size={18} />
            </button>
            <button className="p1r-iconBtn" onClick={() => window.location.reload()} title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="p1r-iconBtn" onClick={() => window.print()} title="Print">
              <Printer size={18} />
            </button>
            <button className="p1r-primary p1-add-btn primary" onClick={openAdd}>
              <Plus size={18} />
              Add Farmer
            </button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="p1r-stats">
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Total Farmers</div>
            <div className="p1r-statValue">{stats.total}</div>
            <div className="p1r-statMeta">Registered farmers</div>
          </div>
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Barangays</div>
            <div className="p1r-statValue">{Object.keys(stats.byBarangay).length}</div>
            <div className="p1r-statMeta">Covered</div>
          </div>
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Male / Female</div>
            <div className="p1r-statValue">{stats.byGender.Male || 0} / {stats.byGender.Female || 0}</div>
            <div className="p1r-statMeta">Gender distribution</div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="p1r-toolbar">
          <div className="p1r-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farmer name, barangay, farm, contact…"
            />
            {search ? (
              <button className="p1r-clear" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="p1r-filters">
            <div className="p1r-filter">
              <Filter size={16} />
              <select value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)}>
                <option value="">All {barangayOptions.length} Barangays</option>
                {barangayOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="p1r-tableWrap">
          <table className="p1r-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Farmer Name</th>
                <th>Contact</th>
                <th>Gender</th>
                <th>Farm Name</th>
                <th>Farm Type</th>
                <th>Livestock</th>
                <th className="p1r-actionsCol">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p1r-empty">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p1r-empty">No farmers found.</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="p1r-row" onClick={() => openView(r)}>
                    <td className="p1r-strong">{r.barangay || "—"}</td>
                    <td>{`${r.firstName || ""} ${r.lastName || ""}`.trim() || "—"}</td>
                    <td>{r.contact || "—"}</td>
                    <td>{r.gender || "—"}</td>
                    <td>{r.farmName || "—"}</td>
                    <td>{r.farmType || "—"}</td>
                    <td>{Number(r.livestockCount) || 0}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="p1r-actions">
                        <button className="p1r-icoBtn" onClick={() => openView(r)} title="View">
                          <Eye size={16} />
                        </button>
                        <button className="p1r-icoBtn" onClick={() => openEdit(r)} title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button className="p1r-icoBtn danger" onClick={() => requestDelete(r.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="p1r-footer">
            <div className="p1r-footerItem">
              <span className="p1r-footerLabel">Showing:</span>
              <span className="p1r-footerValue">{filtered.length} of {rows.length} farmers</span>
            </div>
            <div className="p1r-footerItem">
              <span className="p1r-footerLabel">Total Livestock:</span>
              <span className="p1r-footerValue">{filtered.reduce((sum, r) => sum + (Number(r.livestockCount) || 0), 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      <ModalShell
        open={openForm}
        title={editingId ? "Edit Farmer" : "Add Farmer"}
        onClose={() => (busySave ? null : setOpenForm(false))}
      >
        <div className="p1m2-grid">
          {/* FARMER INFORMATION */}
          <section className="p1m2-card">
            <div className="p1m2-cardHead">
              <div className="p1m2-cardTitle">
                <User size={18} />
                <span>Farmer Information</span>
              </div>
              <div className="p1m2-cardHint">Personal details</div>
            </div>

            <div className="p1m2-fields">
              {inlineErr && <div className="p1m2-inlineErr">{inlineErr}</div>}
              {inlineMsg && <div className="p1m2-inlineOk">{inlineMsg}</div>}

              <div className="arv-groupBox">
                <div className="arv-groupTitle">Location</div>
                <div className="arv-miniGrid">
                  <label className="arv-field wide">
                    <span className="arv-label">*Barangay</span>
                    <select value={form.barangay} onChange={setF("barangay")}>
                      <option value="">Select barangay…</option>
                      {barangayOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="arv-sectionTitle">
                <User size={16} />
                <span>Farmer Details</span>
              </div>

              <div className="arv-grid2">
                <label className="arv-field">
                  <span className="arv-label">*First Name</span>
                  <input value={form.firstName} onChange={setF("firstName")} />
                </label>
                <label className="arv-field">
                  <span className="arv-label">Middle Name</span>
                  <input value={form.middleName} onChange={setF("middleName")} />
                </label>
                <label className="arv-field">
                  <span className="arv-label">*Last Name</span>
                  <input value={form.lastName} onChange={setF("lastName")} />
                </label>
                <label className="arv-field">
                  <span className="arv-label">Gender</span>
                  <select value={form.gender} onChange={setF("gender")}>
                    <option value="">—</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="arv-field">
                  <span className="arv-label">Birthday</span>
                  <input type="date" value={form.birthday} onChange={setF("birthday")} />
                </label>
                <label className="arv-field">
                  <span className="arv-label">*Contact No.</span>
                  <input value={form.contact} onChange={setF("contact")} placeholder="09xxxxxxxxx" />
                </label>
              </div>
            </div>
          </section>

          {/* FARM INFORMATION */}
          <aside className="p1m2-card">
            <div className="p1m2-cardHead">
              <div className="p1m2-cardTitle">
                <Home size={18} />
                <span>Farm Information</span>
              </div>
              <div className="p1m2-cardHint">Optional details</div>
            </div>

            <div className="p1m2-fields">
              <div className="arv-grid2">
                <label className="arv-field">
                  <span className="arv-label">Farm Name</span>
                  <input value={form.farmName} onChange={setF("farmName")} />
                </label>
                <label className="arv-field">
                  <span className="arv-label">Farm Type</span>
                  <input value={form.farmType} onChange={setF("farmType")} placeholder="e.g., Crop, Livestock, Mixed" />
                </label>
                <label className="arv-field">
                  <span className="arv-label">Farm Size (ha)</span>
                  <input value={form.farmSize} onChange={setF("farmSize")} placeholder="e.g., 2.5" />
                </label>
                <label className="arv-field">
                  <span className="arv-label">Livestock Count</span>
                  <input
                    type="number"
                    min="0"
                    value={form.livestockCount}
                    onChange={(e) => setForm((p) => ({ ...p, livestockCount: e.target.value }))}
                  />
                </label>
                <label className="arv-field wide">
                  <span className="arv-label">Remarks</span>
                  <input value={form.remarks} onChange={setF("remarks")} />
                </label>
              </div>

              <div className="arv-miniHint">
                Saved to Firestore: <b>{COL_NAME}</b>
              </div>
            </div>
          </aside>
        </div>

        <div className="p1m2-foot">
          <div className="p1m2-footNote">
            <span className="p1m2-chip active">{editingId ? "Editing" : "New Record"}</span>
            <span>{DEFAULT_PROVINCE} • {DEFAULT_MUNICIPALITY}</span>
          </div>
          <div className="p1m2-actions">
            <button className="p1m2-btn ghost" onClick={() => setOpenForm(false)} disabled={busySave}>
              Cancel
            </button>
            <button className="p1m2-btn" onClick={save} disabled={busySave}>
              {busySave ? "Saving…" : editingId ? "Update Farmer" : "Save Farmer"}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* VIEW DRAWER */}
      <button className={`p1d-overlay ${viewOpen ? "show" : ""}`} onClick={() => setViewOpen(false)} aria-label="Close details" />
      <aside className={`p1d-drawer ${viewOpen ? "open" : ""}`}>
        <div className="p1d-head">
          <div className="p1d-title">Farmer Details</div>
          <button className="p1d-x" onClick={() => setViewOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p1d-body">
          {viewRow ? (
            <div className="p1d-grid">
              <div className="p1d-item">
                <div className="p1d-k">Full Name</div>
                <div className="p1d-v">{`${viewRow.firstName || ""} ${viewRow.lastName || ""}`.trim() || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Gender / Birthday</div>
                <div className="p1d-v">{viewRow.gender || "—"} • {viewRow.birthday || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Contact</div>
                <div className="p1d-v">{viewRow.contact || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Barangay</div>
                <div className="p1d-v">{viewRow.barangay || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Farm Name</div>
                <div className="p1d-v">{viewRow.farmName || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Farm Type</div>
                <div className="p1d-v">{viewRow.farmType || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Farm Size</div>
                <div className="p1d-v">{viewRow.farmSize || "—"} ha</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Livestock Count</div>
                <div className="p1d-v">{Number(viewRow.livestockCount) || 0}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Remarks</div>
                <div className="p1d-v">{viewRow.remarks || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Created</div>
                <div className="p1d-v">{viewRow.createdAt?.toDate ? fmtDate(viewRow.createdAt.toDate()) : "—"}</div>
              </div>
            </div>
          ) : (
            <div className="p1d-muted">No record selected.</div>
          )}
        </div>
      </aside>

      {/* EXPORT MODAL */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        open={delOpen}
        title="Delete farmer record?"
        message="This will permanently remove the farmer from the database."
        onCancel={() => (busyDel ? null : setDelOpen(false))}
        onConfirm={confirmDelete}
        busy={busyDel}
      />
    </div>
  );
}