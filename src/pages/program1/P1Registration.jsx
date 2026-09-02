// src/pages/program1/P1Registration.jsx
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
  PawPrint,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Users, // new icon for farmers
} from "lucide-react";

const COL_NAME = "program1_animals";
const FARMERS_COL = "program1_farmers";

/** Fixed location defaults */
const DEFAULT_PROVINCE = "Oriental Mindoro";
const DEFAULT_MUNICIPALITY = "Naujan";

/** Complete BARANGAYS (same as before) */
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
  "Tongyan",
];

const SORTED_BARANGAYS = [...BARANGAYS].sort((a, b) => a.localeCompare(b));

const GENDER_OPTIONS = ["Male", "Female"];
const SEX_OPTIONS = ["Male", "Female"];
const YESNO_OPTIONS = ["Yes", "No"];

/** Species options (unchanged) */
const SPECIES_OPTIONS = [
  { species: "Dog", type: "Canine" },
  { species: "Cat", type: "Feline" },
  { species: "cattle", type: "Bovine" },
  { species: "kabayo", type: "Equine" },
  { species: "Swine", type: "Porcine" },
  { species: "Goat", type: "Caprine" },
  { species: "Sheep", type: "Ovine" },
  { species: "Poultry", type: "Avian" },
  { species: "Carabao", type: "Bubaline" },
  { species: "Other", type: "Other" },
];

const EXPORT_FORMATS = [
  { value: "csv", label: "CSV (Excel)" },
  { value: "pdf", label: "PDF Report" },
  { value: "json", label: "JSON (Backup)" },
];

const emptyForm = () => ({
  province: DEFAULT_PROVINCE,
  municipality: DEFAULT_MUNICIPALITY,

  // linked farmer
  farmerId: "",

  // owner (auto-filled from farmer)
  ownerFirstName: "",
  ownerMI: "",
  ownerLastName: "",
  ownerGender: "",
  ownerBirthday: "",
  ownerContact: "",

  // location
  barangay: "",

  // animal
  tagId: "",
  species: "",
  speciesType: "",
  speciesOther: "",
  sex: "",
  age: "",
  breed: "",
  animalRegistered: "",
  noOfHeads: 1,
  remarks: "",
});

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatDateTime(date) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date;
  }
}

/* ===== Export Modal (identical) ===== */
function ExportModal({ open, onClose, onExport }) {
  const [exportFormat, setExportFormat] = useState("csv");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [includeDetails, setIncludeDetails] = useState({
    ownerInfo: true,
    animalInfo: true,
    locationInfo: true,
    summary: true,
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport({ format: exportFormat, dateRange, includeDetails });
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
            <div className="p1m2-title">Export Registered Animals</div>
            <div className="p1m2-sub">Download complete animal registration list</div>
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
                      checked={includeDetails.ownerInfo}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          ownerInfo: e.target.checked,
                        }))
                      }
                    />
                    <span>Owner Information</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.animalInfo}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          animalInfo: e.target.checked,
                        }))
                      }
                    />
                    <span>Animal Information</span>
                  </label>
                  <label className="p1m2-checkbox">
                    <input
                      type="checkbox"
                      checked={includeDetails.locationInfo}
                      onChange={(e) =>
                        setIncludeDetails((d) => ({
                          ...d,
                          locationInfo: e.target.checked,
                        }))
                      }
                    />
                    <span>Location Details</span>
                  </label>
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
                Animal Registration (Owner + Animal). Province & Municipality fixed (
                Oriental Mindoro • Naujan).
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

function ConfirmModal({ open, title, message, onCancel, onConfirm, busy }) {
  if (!open) return null;
  return (
    <div className="p1c-wrap" role="dialog" aria-modal="true">
      <button
        className="p1c-overlay"
        onClick={busy ? undefined : onCancel}
        aria-label="Close"
      />
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

export default function P1AnimalRegistration() {
  const [rows, setRows] = useState([]);
  const [farmers, setFarmers] = useState([]); // ✅ new state for farmers
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");

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

  // Real-time listener for animals
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

  // ✅ Real-time listener for farmers (for dropdown)
  useEffect(() => {
    const q = query(collection(db, FARMERS_COL), orderBy("firstName", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setFarmers(list);
    });
    return () => unsub();
  }, []);

  const barangayOptions = useMemo(() => SORTED_BARANGAYS, []);

  const speciesOptions = useMemo(() => {
    const species = new Set();
    rows.forEach((r) => {
      if (r.species === "Other") {
        if (r.speciesOther) species.add(r.speciesOther);
      } else if (r.species) {
        species.add(r.species);
      }
    });
    return Array.from(species).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesBarangay = barangayFilter ? (r.barangay || "") === barangayFilter : true;
      if (!matchesBarangay) return false;

      const animalSpecies = r.species === "Other" ? r.speciesOther : r.species;
      const matchesSpecies = speciesFilter ? animalSpecies === speciesFilter : true;
      if (!matchesSpecies) return false;

      if (!s) return true;
      const hay = [
        r.barangay,
        r.ownerFirstName,
        r.ownerLastName,
        r.ownerContact,
        r.tagId,
        r.species,
        r.speciesType,
        r.speciesOther,
        r.breed,
        r.sex,
        r.age,
        r.remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [rows, search, barangayFilter, speciesFilter]);

  // Stats (unchanged)
  const stats = useMemo(() => {
    const total = rows.length;
    const bySpecies = {};
    const bySpeciesType = {};
    const byBarangay = {};
    const registered = rows.filter((r) => r.animalRegistered === "Yes").length;
    const totalHeads = rows.reduce((sum, r) => sum + (Number(r.noOfHeads) || 0), 0);

    rows.forEach((r) => {
      const species =
        r.species === "Other" ? r.speciesOther || "Other" : r.species || "Unknown";
      bySpecies[species] = (bySpecies[species] || 0) + 1;
      if (r.speciesType) {
        bySpeciesType[r.speciesType] = (bySpeciesType[r.speciesType] || 0) + 1;
      }
      const barangay = r.barangay || "Unknown";
      byBarangay[barangay] = (byBarangay[barangay] || 0) + 1;
    });

    return { total, bySpecies, bySpeciesType, byBarangay, registered, totalHeads };
  }, [rows]);

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

    // Pre-fill form from existing row
    const initialForm = {
      province: row.province || DEFAULT_PROVINCE,
      municipality: row.municipality || DEFAULT_MUNICIPALITY,
      farmerId: row.farmerId || "",
      ownerFirstName: row.ownerFirstName || "",
      ownerMI: row.ownerMI || "",
      ownerLastName: row.ownerLastName || "",
      ownerGender: row.ownerGender || "",
      ownerBirthday: row.ownerBirthday || "",
      ownerContact: row.ownerContact || "",
      barangay: row.barangay || "",
      tagId: row.tagId || "",
      species: row.species || "",
      speciesType: row.speciesType || "",
      speciesOther: row.speciesOther || "",
      sex: row.sex || "",
      age: row.age || "",
      breed: row.breed || "",
      animalRegistered: row.animalRegistered || "",
      noOfHeads: row.noOfHeads ?? 1,
      remarks: row.remarks || "",
    };

    // If a farmerId exists, try to auto-fill from the farmers list
    if (row.farmerId) {
      const farmer = farmers.find((f) => f.id === row.farmerId);
      if (farmer) {
        initialForm.barangay = farmer.barangay || "";
        initialForm.ownerFirstName = farmer.firstName || "";
        initialForm.ownerMI = farmer.middleName || "";
        initialForm.ownerLastName = farmer.lastName || "";
        initialForm.ownerGender = farmer.gender || "";
        initialForm.ownerBirthday = farmer.birthday || "";
        initialForm.ownerContact = farmer.contact || "";
      }
    }

    setForm(initialForm);
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

  // ✅ Handler for selecting a farmer from dropdown
  const handleFarmerSelect = (farmerId) => {
    if (!farmerId) {
      // Reset owner fields if "none" selected
      setForm((prev) => ({
        ...prev,
        farmerId: "",
        barangay: "",
        ownerFirstName: "",
        ownerMI: "",
        ownerLastName: "",
        ownerGender: "",
        ownerBirthday: "",
        ownerContact: "",
      }));
      return;
    }

    const farmer = farmers.find((f) => f.id === farmerId);
    if (farmer) {
      setForm((prev) => ({
        ...prev,
        farmerId: farmerId,
        barangay: farmer.barangay || "",
        ownerFirstName: farmer.firstName || "",
        ownerMI: farmer.middleName || "",
        ownerLastName: farmer.lastName || "",
        ownerGender: farmer.gender || "",
        ownerBirthday: farmer.birthday || "",
        ownerContact: farmer.contact || "",
      }));
    }
  };

  const validate = () => {
    // barangay is now auto-filled but we still require it
    if (!form.barangay) return "Barangay is required.";
    if (!form.ownerFirstName.trim()) return "Owner First Name is required.";
    if (!form.ownerLastName.trim()) return "Owner Last Name is required.";
    if (!form.species) return "Species is required.";
    if (form.species === "Other" && !form.speciesOther.trim())
      return "Please specify species.";
    if (!form.noOfHeads || Number(form.noOfHeads) < 1)
      return "No. of heads must be at least 1.";
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
      const speciesOption = SPECIES_OPTIONS.find((s) => s.species === form.species);

      const payload = {
        ...form,
        province: DEFAULT_PROVINCE,
        municipality: DEFAULT_MUNICIPALITY,
        speciesType: speciesOption?.type || "",
        noOfHeads: Number(form.noOfHeads || 0),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      if (editingId) {
        await updateDoc(doc(db, COL_NAME, editingId), payload);
        setInlineMsg("Animal record updated successfully.");
      } else {
        await addDoc(collection(db, COL_NAME), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
        setInlineMsg("Animal record saved successfully.");
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

  // Export function (unchanged)
  const handleExport = useCallback(
    async ({ format, dateRange, includeDetails }) => {
      try {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59);

        const filteredRows = rows.filter((r) => {
          const createdDate = r.createdAt?.toDate
            ? r.createdAt.toDate()
            : new Date(r.createdAt);
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
            species: speciesFilter || "All",
            search: search || "None",
          },
          summary: {
            totalRecords: filteredRows.length,
            totalHeads: filteredRows.reduce(
              (sum, r) => sum + (Number(r.noOfHeads) || 0),
              0
            ),
            registeredAnimals: filteredRows.filter(
              (r) => r.animalRegistered === "Yes"
            ).length,
            bySpecies: {},
            bySpeciesType: {},
            byBarangay: {},
          },
        };

        filteredRows.forEach((r) => {
          const species =
            r.species === "Other" ? r.speciesOther || "Other" : r.species || "Unknown";
          exportData.summary.bySpecies[species] =
            (exportData.summary.bySpecies[species] || 0) + 1;
          if (r.speciesType) {
            exportData.summary.bySpeciesType[r.speciesType] =
              (exportData.summary.bySpeciesType[r.speciesType] || 0) + 1;
          }
          const barangay = r.barangay || "Unknown";
          exportData.summary.byBarangay[barangay] =
            (exportData.summary.byBarangay[barangay] || 0) + 1;
        });

        exportData.records = filteredRows.map((row) => {
          const record = {};
          if (includeDetails.ownerInfo) {
            record.owner = {
              firstName: row.ownerFirstName || "",
              middleName: row.ownerMI || "",
              lastName: row.ownerLastName || "",
              fullName: `${row.ownerFirstName || ""} ${row.ownerLastName || ""}`.trim(),
              gender: row.ownerGender || "",
              birthday: row.ownerBirthday || "",
              contact: row.ownerContact || "",
            };
          }
          if (includeDetails.locationInfo) {
            record.location = {
              province: row.province || DEFAULT_PROVINCE,
              municipality: row.municipality || DEFAULT_MUNICIPALITY,
              barangay: row.barangay || "",
            };
          }
          if (includeDetails.animalInfo) {
            record.animal = {
              tagId: row.tagId || "",
              species:
                row.species === "Other" ? row.speciesOther || "Other" : row.species || "",
              speciesType: row.speciesType || "",
              speciesOther: row.speciesOther || "",
              sex: row.sex || "",
              age: row.age || "",
              breed: row.breed || "",
              registered: row.animalRegistered || "",
              heads: Number(row.noOfHeads) || 0,
              remarks: row.remarks || "",
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
          let csv = "NAUJAN ANIMAL DATABASE 2025\n";
          csv += `Municipality: ${DEFAULT_MUNICIPALITY}, Province: ${DEFAULT_PROVINCE}\n`;
          csv += `Exported: ${new Date().toLocaleString()}\n`;
          csv += `Exported By: ${auth.currentUser?.email || "Unknown"}\n`;
          csv += `Date Range: ${dateRange.start} to ${dateRange.end}\n`;
          csv += `Filters: Barangay=${barangayFilter || "All"}, Species=${
            speciesFilter || "All"
          }\n\n`;

          if (includeDetails.summary) {
            csv += "SUMMARY STATISTICS\n";
            csv += `Total Records,${exportData.summary.totalRecords}\n`;
            csv += `Total Heads,${exportData.summary.totalHeads}\n`;
            csv += `Registered Animals,${exportData.summary.registeredAnimals}\n\n`;
            csv += "BREAKDOWN BY SPECIES\n";
            csv += "Species,Count\n";
            Object.entries(exportData.summary.bySpecies)
              .sort(([a], [b]) => a.localeCompare(b))
              .forEach(([species, count]) => {
                csv += `${species},${count}\n`;
              });
            csv += "\n";
            csv += "BREAKDOWN BY SPECIES TYPE\n";
            csv += "Species Type,Count\n";
            Object.entries(exportData.summary.bySpeciesType)
              .sort(([a], [b]) => a.localeCompare(b))
              .forEach(([type, count]) => {
                csv += `${type},${count}\n`;
              });
            csv += "\n";
            csv += "BREAKDOWN BY BARANGAY\n";
            csv += "Barangay,Count\n";
            Object.entries(exportData.summary.byBarangay)
              .sort(([a], [b]) => a.localeCompare(b))
              .forEach(([barangay, count]) => {
                csv += `${barangay},${count}\n`;
              });
            csv += "\n";
          }

          let headers = [];
          if (includeDetails.ownerInfo) {
            headers.push(
              "Owner First Name",
              "Owner MI",
              "Owner Last Name",
              "Owner Gender",
              "Owner Birthday",
              "Owner Contact"
            );
          }
          if (includeDetails.locationInfo) {
            headers.push("Province", "Municipality", "Barangay");
          }
          if (includeDetails.animalInfo) {
            headers.push(
              "Tag ID",
              "Species",
              "Species Type",
              "Sex",
              "Age",
              "Breed",
              "Registered",
              "No. of Heads",
              "Remarks"
            );
          }
          headers.push("Created Date", "Last Updated", "Record ID");

          csv += headers.join(",") + "\n";

          exportData.records.forEach((record) => {
            let row = [];
            if (includeDetails.ownerInfo) {
              row.push(
                `"${record.owner.firstName}"`,
                `"${record.owner.middleName}"`,
                `"${record.owner.lastName}"`,
                record.owner.gender,
                record.owner.birthday,
                `"${record.owner.contact}"`
              );
            }
            if (includeDetails.locationInfo) {
              row.push(
                record.location.province,
                record.location.municipality,
                record.location.barangay
              );
            }
            if (includeDetails.animalInfo) {
              row.push(
                `"${record.animal.tagId}"`,
                `"${record.animal.species}"`,
                record.animal.speciesType,
                record.animal.sex,
                `"${record.animal.age}"`,
                `"${record.animal.breed}"`,
                record.animal.registered,
                record.animal.heads,
                `"${record.animal.remarks}"`
              );
            }
            row.push(
              record.metadata.createdAt
                ? formatDateTime(record.metadata.createdAt)
                : "",
              record.metadata.updatedAt
                ? formatDateTime(record.metadata.updatedAt)
                : "",
              record.metadata.id
            );
            csv += row.join(",") + "\n";
          });

          csv += `\nTotal Records,${exportData.records.length}`;
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Naujan_Animals_${new Date().toISOString().split("T")[0]}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else if (format === "pdf") {
          const willHaveManyCols =
            includeDetails.ownerInfo +
              includeDetails.locationInfo +
              includeDetails.animalInfo >=
            2;
          const doc = new jsPDF({
            orientation: willHaveManyCols ? "landscape" : "portrait",
          });
          const fileName = `Naujan_Animals_${new Date().toISOString().split("T")[0]}.pdf`;

          doc.setFontSize(14);
          doc.text("ANIMAL REGISTRATION REPORT", 14, 15);
          doc.setFontSize(10);
          const metaLines = [
            `Province: ${DEFAULT_PROVINCE}`,
            `Municipality: ${DEFAULT_MUNICIPALITY}`,
            `Exported: ${new Date().toLocaleString("en-PH")}`,
            `Exported By: ${auth.currentUser?.email || "Unknown"}`,
            `Date Range: ${dateRange.start} to ${dateRange.end}`,
            `Filters: Barangay=${barangayFilter || "All"}, Species=${
              speciesFilter || "All"
            }, Search=${search || "None"}`,
            `Total Records: ${filteredRows.length}`,
          ];
          let y = 22;
          metaLines.forEach((line) => {
            doc.text(line, 14, y);
            y += 5;
          });

          if (includeDetails.summary) {
            const summaryStartY = y + 4;
            autoTable(doc, {
              startY: summaryStartY,
              head: [["Summary", "Value"]],
              body: [
                ["Total Records", String(exportData.summary.totalRecords)],
                ["Total Heads", String(exportData.summary.totalHeads)],
                ["Registered Animals", String(exportData.summary.registeredAnimals)],
              ],
              styles: { fontSize: 9 },
              headStyles: { fontStyle: "bold" },
            });
            let nextY = doc.lastAutoTable.finalY + 6;

            const bySpeciesRows = Object.entries(exportData.summary.bySpecies)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, String(v)]);
            if (bySpeciesRows.length) {
              autoTable(doc, {
                startY: nextY,
                head: [["Breakdown by Species", "Count"]],
                body: bySpeciesRows,
                styles: { fontSize: 9 },
                headStyles: { fontStyle: "bold" },
              });
              nextY = doc.lastAutoTable.finalY + 6;
            }

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
              nextY = doc.lastAutoTable.finalY + 8;
            }
            y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 10;
          } else {
            y += 6;
          }

          const head = [];
          const colKeys = [];

          if (includeDetails.ownerInfo) {
            head.push("Owner");
            colKeys.push("ownerName");
            head.push("Contact");
            colKeys.push("ownerContact");
            head.push("Gender");
            colKeys.push("ownerGender");
            head.push("Birthday");
            colKeys.push("ownerBirthday");
          }
          if (includeDetails.locationInfo) {
            head.push("Barangay");
            colKeys.push("barangay");
            head.push("Province");
            colKeys.push("province");
            head.push("Municipality");
            colKeys.push("municipality");
          }
          if (includeDetails.animalInfo) {
            head.push("Tag ID");
            colKeys.push("tagId");
            head.push("Species");
            colKeys.push("species");
            head.push("Species Type");
            colKeys.push("speciesType");
            head.push("Breed");
            colKeys.push("breed");
            head.push("Sex");
            colKeys.push("sex");
            head.push("Age");
            colKeys.push("age");
            head.push("Heads");
            colKeys.push("heads");
            head.push("Registered");
            colKeys.push("registered");
            head.push("Remarks");
            colKeys.push("remarks");
          }
          head.push("Created");
          colKeys.push("createdAt");
          head.push("Updated");
          colKeys.push("updatedAt");

          const body = filteredRows.map((r) => {
            const created = r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt;
            const updated = r.updatedAt?.toDate ? r.updatedAt.toDate() : r.updatedAt;
            const obj = {
              ownerName: `${r.ownerFirstName || ""} ${r.ownerLastName || ""}`.trim(),
              ownerContact: r.ownerContact || "",
              ownerGender: r.ownerGender || "",
              ownerBirthday: r.ownerBirthday || "",
              barangay: r.barangay || "",
              province: r.province || DEFAULT_PROVINCE,
              municipality: r.municipality || DEFAULT_MUNICIPALITY,
              tagId: r.tagId || "",
              species:
                r.species === "Other" ? r.speciesOther || "Other" : r.species || "",
              speciesType: r.speciesType || "",
              breed: r.breed || "",
              sex: r.sex || "",
              age: r.age || "",
              heads: String(Number(r.noOfHeads) || 0),
              registered: r.animalRegistered || "",
              remarks: r.remarks || "",
              createdAt: created ? formatDateTime(created) : "",
              updatedAt: updated ? formatDateTime(updated) : "",
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
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Naujan_Animals_Backup_${new Date()
            .toISOString()
            .split("T")[0]}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }

        alert(
          `✅ Export successful!\n\n${filteredRows.length} records exported as ${format.toUpperCase()}`
        );
      } catch (e) {
        console.error("Export failed:", e);
        alert(`❌ Export failed: ${e.message}`);
      }
    },
    [rows, barangayFilter, speciesFilter, search]
  );

  const setF = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSpeciesChange = (e) => {
    const selectedSpecies = e.target.value;
    const speciesOption = SPECIES_OPTIONS.find((s) => s.species === selectedSpecies);
    setForm((prev) => ({
      ...prev,
      species: selectedSpecies,
      speciesType: speciesOption?.type || "",
    }));
  };

  return (
    <div className="p1r-page p1-fontPro">
      <div className="p1r-shell">
        {/* HEADER */}
        <div className="p1r-top">
          <div>
            <div className="p1r-h1">Animal Registration</div>
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
            <button
              className="p1r-iconBtn"
              onClick={() => window.location.reload()}
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button
              className="p1r-iconBtn"
              onClick={() => window.print()}
              title="Print"
            >
              <Printer size={18} />
            </button>
            <button className="p1r-primary p1-add-btn primary" onClick={openAdd}>
              <Plus size={18} />
              Add Animal
            </button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="p1r-stats">
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Total Animals</div>
            <div className="p1r-statValue">{stats.total}</div>
            <div className="p1r-statMeta">Registered records</div>
          </div>
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Total Heads</div>
            <div className="p1r-statValue">{stats.totalHeads}</div>
            <div className="p1r-statMeta">Combined count</div>
          </div>
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Registered</div>
            <div className="p1r-statValue">{stats.registered}</div>
            <div className="p1r-statMeta">With papers</div>
          </div>
          <div className="p1r-statCard">
            <div className="p1r-statLabel">Species</div>
            <div className="p1r-statValue">{Object.keys(stats.bySpecies).length}</div>
            <div className="p1r-statMeta">Different types</div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="p1r-toolbar">
          <div className="p1r-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search owner, barangay, tag, species, breed…"
            />
            {search ? (
              <button
                className="p1r-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="p1r-filters">
            <div className="p1r-filter">
              <Filter size={16} />
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
              >
                <option value="">All {barangayOptions.length} Barangays</option>
                {barangayOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="p1r-filter">
              <Filter size={16} />
              <select
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value)}
              >
                <option value="">All Species</option>
                {speciesOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
                <th>Owner</th>
                <th>Contact</th>
                <th>Tag ID</th>
                <th>Species</th>
                <th>Species Type</th>
                <th>Breed</th>
                <th>Sex</th>
                <th>Heads</th>
                <th>Registered</th>
                <th className="p1r-actionsCol">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p1r-empty">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p1r-empty">
                    No animal records found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="p1r-row" onClick={() => openView(r)}>
                    <td className="p1r-strong">{r.barangay || "—"}</td>
                    <td>
                      {`${r.ownerFirstName || ""} ${r.ownerLastName || ""}`.trim() ||
                        "—"}
                    </td>
                    <td>{r.ownerContact || "—"}</td>
                    <td>{r.tagId || "—"}</td>
                    <td>
                      {r.species === "Other" ? r.speciesOther || "Other" : r.species || "—"}
                    </td>
                    <td>{r.speciesType || "—"}</td>
                    <td>{r.breed || "—"}</td>
                    <td>{r.sex || "—"}</td>
                    <td>{Number(r.noOfHeads || 0)}</td>
                    <td>
                      <span
                        className={`p1r-badge ${
                          r.animalRegistered === "Yes" ? "success" : "pending"
                        }`}
                      >
                        {r.animalRegistered || "No"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="p1r-actions">
                        <button
                          className="p1r-icoBtn"
                          onClick={() => openView(r)}
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="p1r-icoBtn"
                          onClick={() => openEdit(r)}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="p1r-icoBtn danger"
                          onClick={() => requestDelete(r.id)}
                          title="Delete"
                        >
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

        {/* Summary Footer */}
        {filtered.length > 0 && (
          <div className="p1r-footer">
            <div className="p1r-footerItem">
              <span className="p1r-footerLabel">Showing:</span>
              <span className="p1r-footerValue">
                {filtered.length} of {rows.length} records
              </span>
            </div>
            <div className="p1r-footerItem">
              <span className="p1r-footerLabel">Total Heads:</span>
              <span className="p1r-footerValue">
                {filtered.reduce((sum, r) => sum + (Number(r.noOfHeads) || 0), 0)}
              </span>
            </div>
            <div className="p1r-footerItem">
              <span className="p1r-footerLabel">Barangays:</span>
              <span className="p1r-footerValue">{barangayOptions.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      <ModalShell
        open={openForm}
        title={editingId ? "Edit Animal Registration" : "Add Animal Registration"}
        onClose={() => (busySave ? null : setOpenForm(false))}
      >
        <div className="p1m2-grid">
          {/* OWNER */}
          <section className="p1m2-card">
            <div className="p1m2-cardHead">
              <div className="p1m2-cardTitle">
                <User size={18} />
                <span>Owner Information</span>
              </div>
              <div className="p1m2-cardHint">Select a registered farmer</div>
            </div>

            <div className="p1m2-fields">
              {inlineErr ? <div className="p1m2-inlineErr">{inlineErr}</div> : null}
              {inlineMsg ? <div className="p1m2-inlineOk">{inlineMsg}</div> : null}

              {/* ✅ Farmer dropdown */}
              <div className="arv-groupBox">
                <div className="arv-groupTitle">Farmer (Owner)</div>
                <div className="arv-miniGrid">
                  <label className="arv-field wide">
                    <span className="arv-label">
                      <Users size={14} style={{ display: "inline", marginRight: 4 }} />
                      Select Registered Farmer
                    </span>
                    <select
                      value={form.farmerId}
                      onChange={(e) => handleFarmerSelect(e.target.value)}
                    >
                      <option value="">— Choose a farmer —</option>
                      {farmers.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.firstName} {f.lastName} — {f.barangay || "No barangay"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {farmers.length === 0 && (
                  <div className="arv-miniHint" style={{ color: "#b91c1c" }}>
                    No farmers registered yet. Please add farmers first.
                  </div>
                )}
              </div>

              <div className="arv-sectionTitle">
                <ClipboardList size={16} />
                <span>Owner Details (auto-filled from farmer)</span>
              </div>

              <div className="arv-grid2">
                <label className="arv-field">
                  <span className="arv-label">*First Name</span>
                  <input
                    value={form.ownerFirstName}
                    onChange={setF("ownerFirstName")}
                    placeholder="Auto-filled"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">M.I.</span>
                  <input
                    value={form.ownerMI}
                    onChange={setF("ownerMI")}
                    placeholder="Auto-filled"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">*Last Name</span>
                  <input
                    value={form.ownerLastName}
                    onChange={setF("ownerLastName")}
                    placeholder="Auto-filled"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">Gender</span>
                  <select value={form.ownerGender} onChange={setF("ownerGender")}>
                    <option value="">—</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="arv-field">
                  <span className="arv-label">Birthday</span>
                  <input
                    type="date"
                    value={form.ownerBirthday}
                    onChange={setF("ownerBirthday")}
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">*Contact No.</span>
                  <input
                    value={form.ownerContact}
                    onChange={setF("ownerContact")}
                    placeholder="09xxxxxxxxx"
                  />
                </label>
              </div>

              {/* Barangay (hidden but required) */}
              <div style={{ display: "none" }}>
                <input value={form.barangay} onChange={setF("barangay")} />
              </div>
            </div>
          </section>

          {/* ANIMAL (unchanged) */}
          <aside className="p1m2-card">
            <div className="p1m2-cardHead">
              <div className="p1m2-cardTitle">
                <PawPrint size={18} />
                <span>Animal Information</span>
              </div>
              <div className="p1m2-cardHint">Tag + Species + Details</div>
            </div>

            <div className="p1m2-fields">
              <div className="arv-grid2">
                <label className="arv-field">
                  <span className="arv-label">Tag ID</span>
                  <input
                    value={form.tagId}
                    onChange={setF("tagId")}
                    placeholder="Optional"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">*Species</span>
                  <select value={form.species} onChange={handleSpeciesChange}>
                    <option value="">Select…</option>
                    {SPECIES_OPTIONS.map((s) => (
                      <option key={s.species} value={s.species}>
                        {s.species} ({s.type})
                      </option>
                    ))}
                  </select>
                </label>

                {form.species === "Other" ? (
                  <label className="arv-field wide">
                    <span className="arv-label">Specify Species</span>
                    <input value={form.speciesOther} onChange={setF("speciesOther")} />
                  </label>
                ) : null}

                <label className="arv-field">
                  <span className="arv-label">Species Type</span>
                  <input
                    value={form.speciesType}
                    readOnly
                    className="arv-readonlyLine"
                    placeholder="Auto-filled"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">Breed</span>
                  <input value={form.breed} onChange={setF("breed")} />
                </label>

                <label className="arv-field">
                  <span className="arv-label">Sex</span>
                  <select value={form.sex} onChange={setF("sex")}>
                    <option value="">—</option>
                    {SEX_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="arv-field">
                  <span className="arv-label">Age</span>
                  <input
                    value={form.age}
                    onChange={setF("age")}
                    placeholder="e.g., 2 yrs / 3 mo"
                  />
                </label>

                <label className="arv-field">
                  <span className="arv-label">Animal Registered</span>
                  <select value={form.animalRegistered} onChange={setF("animalRegistered")}>
                    <option value="">—</option>
                    {YESNO_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="arv-field">
                  <span className="arv-label">No. of Heads</span>
                  <input
                    type="number"
                    min="1"
                    value={form.noOfHeads}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, noOfHeads: e.target.value }))
                    }
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
            <span className="p1m2-chip active">
              {editingId ? "Editing" : "New Record"}
            </span>
            <span>
              {DEFAULT_PROVINCE} • {DEFAULT_MUNICIPALITY}
            </span>
          </div>
          <div className="p1m2-actions">
            <button
              className="p1m2-btn ghost"
              onClick={() => setOpenForm(false)}
              disabled={busySave}
            >
              Cancel
            </button>
            <button className="p1m2-btn" onClick={save} disabled={busySave}>
              {busySave ? "Saving…" : editingId ? "Update Record" : "Save Record"}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* VIEW DRAWER (unchanged) */}
      <button
        className={`p1d-overlay ${viewOpen ? "show" : ""}`}
        onClick={() => setViewOpen(false)}
        aria-label="Close details"
      />
      <aside className={`p1d-drawer ${viewOpen ? "open" : ""}`}>
        <div className="p1d-head">
          <div className="p1d-title">Animal Details</div>
          <button className="p1d-x" onClick={() => setViewOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p1d-body">
          {viewRow ? (
            <div className="p1d-grid">
              <div className="p1d-item">
                <div className="p1d-k">Owner</div>
                <div className="p1d-v">
                  {`${viewRow.ownerFirstName || ""} ${viewRow.ownerLastName || ""}`.trim() ||
                    "—"}
                </div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Contact</div>
                <div className="p1d-v">{viewRow.ownerContact || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Barangay</div>
                <div className="p1d-v">{viewRow.barangay || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Animal</div>
                <div className="p1d-v">
                  {(viewRow.species === "Other"
                    ? viewRow.speciesOther || "Other"
                    : viewRow.species) || "—"}
                  {viewRow.speciesType && ` (${viewRow.speciesType})`}
                </div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Breed / Sex</div>
                <div className="p1d-v">
                  {viewRow.breed || "—"} • {viewRow.sex || "—"}
                </div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Tag / Heads</div>
                <div className="p1d-v">
                  {viewRow.tagId || "—"} • {Number(viewRow.noOfHeads || 0)} head(s)
                </div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Registered</div>
                <div className="p1d-v">
                  <span
                    className={`p1r-badge ${
                      viewRow.animalRegistered === "Yes" ? "success" : "pending"
                    }`}
                  >
                    {viewRow.animalRegistered || "No"}
                  </span>
                </div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Remarks</div>
                <div className="p1d-v">{viewRow.remarks || "—"}</div>
              </div>
              <div className="p1d-item">
                <div className="p1d-k">Created</div>
                <div className="p1d-v">
                  {viewRow.createdAt?.toDate ? fmtDate(viewRow.createdAt.toDate()) : "—"}
                </div>
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
        title="Delete animal record?"
        message="This will permanently remove the animal record from Firestore."
        onCancel={() => (busyDel ? null : setDelOpen(false))}
        onConfirm={confirmDelete}
        busy={busyDel}
      />
    </div>
  );
}