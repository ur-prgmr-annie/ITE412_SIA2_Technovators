import { useEffect, useMemo, useState } from "react";
import "../../styles/p2Module.css";
import {
  Plus,
  Search,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

import { db } from "../../services/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

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

const SPECIES_OPTIONS = ["Cattle", "Carabao", "Goat", "Swine"];

const BREEDS_BY_SPECIES = {
  Cattle: [
    "Native",
    "Brahman",
    "Holstein Friesian",
    "Jersey",
    "Sahiwal",
    "Angus",
    "Crossbreed",
  ],
  Carabao: [
    "Native",
    "Bulgarian Murrah",
    "Murrah",
    "Crossbreed",
  ],
  Goat: [
    "Native",
    "Boer",
    "Anglo-Nubian",
    "Saanen",
    "Toggenburg",
    "Alpine",
    "Crossbreed",
  ],
  Swine: [
    "Native",
    "Large White",
    "Landrace",
    "Duroc",
    "Pietrain",
    "Hampshire",
    "Crossbreed",
  ],
};

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "ok";
  if (s === "scheduled" || s === "in_progress") return "warn";
  return "neutral";
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="m2-modalWrap" role="dialog" aria-modal="true">
      <button className="m2-backdrop" onClick={onClose} aria-label="Close" />
      <div className="m2-modal">
        <div className="m2-modalHead">
          <div className="m2-modalTitle">{title}</div>
          <button
            className="m2-iconBtn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="m2-modalBody">{children}</div>
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  reportMonth: "",
  animalTagId: "",
  species: "",
  breed: "",
  color: "",
  sex: "Female",
  age: "",
  barangay: "",
  farmerName: "",
  protocol: "PGF2α",
  startDate: "",
  targetAI: "",
  status: "scheduled",
  remarks: "",
};

export default function P2Estrus() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [schedulesError, setSchedulesError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const qEstrus = query(
      collection(db, "program2_estrus"),
      orderBy("startDate", "desc")
    );

    const unsubEstrus = onSnapshot(
      qEstrus,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRows(list);
        setSchedulesError("");
        setLoadingSchedules(false);
      },
      (error) => {
        console.error("Error loading estrus schedules:", error);
        setRows([]);
        setSchedulesError(error?.message || "Failed to load schedules.");
        setLoadingSchedules(false);
      }
    );

    return () => unsubEstrus();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const sOk = status === "all" ? true : String(r.status) === status;
      const hay =
        `${r.animalTagId || ""} ${r.barangay || ""} ${r.protocol || ""} ${r.status || ""} ${r.species || ""} ${r.breed || ""} ${r.farmerName || ""} ${r.color || ""} ${r.age || ""}`.toLowerCase();
      const qOk = !q.trim() ? true : hay.includes(q.toLowerCase());
      return sOk && qOk;
    });
  }, [rows, q, status]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const scheduled = rows.filter((x) => x.status === "scheduled").length;
    const inprog = rows.filter((x) => x.status === "in_progress").length;
    const done = rows.filter((x) => x.status === "completed").length;
    return { total, scheduled, inprog, done };
  }, [rows]);

  const breedOptions = useMemo(() => {
    return BREEDS_BY_SPECIES[form.species] || [];
  }, [form.species]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSpeciesChange = (value) => {
    setForm((prev) => ({
      ...prev,
      species: value,
      breed: "",
    }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const validateForm = () => {
    if (!form.reportMonth) return "Report Month is required.";
    if (!form.animalTagId.trim()) return "Animal Tag ID is required.";
    if (!form.species.trim()) return "Species is required.";
    if (!form.breed.trim()) return "Breed is required.";
    if (!form.color.trim()) return "Color is required.";
    if (!form.age) return "Age is required.";
    if (!form.barangay.trim()) return "Barangay is required.";
    if (!form.farmerName.trim()) return "Farmer Name is required.";
    if (!form.startDate) return "Start Date is required.";
    if (!form.targetAI) return "Target AI Date is required.";
    return "";
  };

  const findOrCreateProgram2Animal = async () => {
    const normalizedTag = form.animalTagId.trim();
    const animalsRef = collection(db, "program2_animals");
    const existingQ = query(
      animalsRef,
      where("animalTagId", "==", normalizedTag)
    );

    const existingSnap = await getDocs(existingQ);

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];

      await updateDoc(doc(db, "program2_animals", existingDoc.id), {
        species: form.species.trim(),
        breed: form.breed.trim(),
        color: form.color.trim(),
        sex: form.sex,
        age: form.age,
        barangay: form.barangay.trim(),
        farmerName: form.farmerName.trim(),
        remarks: form.remarks.trim(),
        updatedAt: serverTimestamp(),
      });

      return existingDoc.id;
    }

    const newAnimal = await addDoc(animalsRef, {
      animalTagId: normalizedTag,
      species: form.species.trim(),
      breed: form.breed.trim(),
      color: form.color.trim(),
      sex: form.sex,
      age: form.age,
      barangay: form.barangay.trim(),
      farmerName: form.farmerName.trim(),
      remarks: form.remarks.trim(),
      breedingStatus: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newAnimal.id;
  };

  const add = async (e) => {
    e.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    try {
      setSaving(true);

      const animalId = await findOrCreateProgram2Animal();

      await addDoc(collection(db, "program2_estrus"), {
        animalId,
        reportMonth: form.reportMonth,
        animalTagId: form.animalTagId.trim(),
        species: form.species.trim(),
        breed: form.breed.trim(),
        color: form.color.trim(),
        sex: form.sex,
        age: form.age,
        barangay: form.barangay.trim(),
        farmerName: form.farmerName.trim(),
        protocol: form.protocol,
        startDate: form.startDate,
        targetAI: form.targetAI,
        status: form.status,
        remarks: form.remarks.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error saving estrus schedule:", error);
      alert(error?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, next) => {
    try {
      await updateDoc(doc(db, "program2_estrus", id), {
        status: next,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error?.message || "Failed to update status.");
    }
  };

  return (
    <div className="m2">
      <div className="m2-head">
        <div>
          <div className="m2-h1">
            <CalendarClock size={18} /> Animal Identification and Scheduling
          </div>
          <div className="m2-sub">
            Program 2 animal identification and estrus synchronization scheduling.
          </div>
        </div>

        <button className="m2-btn" onClick={() => setOpen(true)} type="button">
          <Plus size={16} /> New Schedule
        </button>
      </div>

      <div className="m2-kpis">
        <div className="m2-kpi">
          <div className="k-label">Total Schedules</div>
          <div className="k-value">{kpi.total}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Scheduled</div>
          <div className="k-value">{kpi.scheduled}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">In Progress</div>
          <div className="k-value">{kpi.inprog}</div>
        </div>
        <div className="m2-kpi">
          <div className="k-label">Completed</div>
          <div className="k-value">{kpi.done}</div>
        </div>
      </div>

      <div className="m2-toolbar">
        <div className="m2-search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search animal, barangay, farmer, protocol..."
          />
        </div>

        <select
          className="m2-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {schedulesError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">Schedules error: {schedulesError}</div>
        </div>
      )}

      <div className="m2-card">
        <div className="m2-cardHead">
          <div className="m2-cardTitle">Animal Identification and Scheduling Records</div>
          <div className="m2-cardHint">
            {loadingSchedules ? "Loading..." : `${filtered.length} result(s)`}
          </div>
        </div>

        <div className="m2-tableWrap">
          <table className="m2-table">
            <thead>
              <tr>
                <th>Report Month</th>
                <th>Animal Tag</th>
                <th>Species</th>
                <th>Breed</th>
                <th>Color</th>
                <th>Sex</th>
                <th>Age</th>
                <th>Barangay</th>
                <th>Farmer</th>
                <th>Protocol</th>
                <th>Start</th>
                <th>Target AI</th>
                <th>Status</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.reportMonth || "-"}</td>
                  <td><b>{r.animalTagId}</b></td>
                  <td>{r.species}</td>
                  <td>{r.breed}</td>
                  <td>{r.color}</td>
                  <td>{r.sex || "-"}</td>
                  <td>{r.age || "-"}</td>
                  <td>{r.barangay}</td>
                  <td>{r.farmerName}</td>
                  <td>{r.protocol}</td>
                  <td>{r.startDate}</td>
                  <td>{r.targetAI}</td>
                  <td>
                    <span className={`m2-badge ${badgeClass(r.status)}`}>
                      {String(r.status).replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="m2-actions">
                      <button
                        className="m2-smallBtn"
                        onClick={() => updateStatus(r.id, "scheduled")}
                        type="button"
                      >
                        <AlertTriangle size={14} /> Scheduled
                      </button>
                      <button
                        className="m2-smallBtn"
                        onClick={() => updateStatus(r.id, "in_progress")}
                        type="button"
                      >
                        <AlertTriangle size={14} /> In prog
                      </button>
                      <button
                        className="m2-smallBtn ok"
                        onClick={() => updateStatus(r.id, "completed")}
                        type="button"
                      >
                        <CheckCircle2 size={14} /> Done
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loadingSchedules && filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="m2-emptyRow">
                    No schedules found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="New Animal Identification and Scheduling Record"
        onClose={() => setOpen(false)}
      >
        <form className="m2-form" onSubmit={add}>
          <div className="m2-grid">
            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginBottom: 4 }}>
              Animal Identification
            </div>

            <label className="m2-field">
              <span>Report Month</span>
              <input
                type="month"
                value={form.reportMonth}
                onChange={(e) => setField("reportMonth", e.target.value)}
                required
              />
            </label>

            <label className="m2-field">
              <span>Animal Tag ID</span>
              <input
                value={form.animalTagId}
                onChange={(e) => setField("animalTagId", e.target.value)}
                placeholder="e.g. NVJ-CT-0001"
                required
              />
            </label>

            <label className="m2-field">
              <span>Species</span>
              <select
                value={form.species}
                onChange={(e) => handleSpeciesChange(e.target.value)}
                required
              >
                <option value="">Select Species</option>
                {SPECIES_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="m2-field">
              <span>Breed</span>
              <select
                value={form.breed}
                onChange={(e) => setField("breed", e.target.value)}
                required
                disabled={!form.species}
              >
                <option value="">
                  {form.species ? "Select Breed" : "Select Species First"}
                </option>
                {breedOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="m2-field">
              <span>Color</span>
              <input
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
                placeholder="e.g. Brown"
                required
              />
            </label>

            <label className="m2-field">
              <span>Sex</span>
              <select
                value={form.sex}
                onChange={(e) => setField("sex", e.target.value)}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>

            <label className="m2-field">
              <span>Age (in years or months)</span>
              <input
                type="text"
                value={form.age}
                onChange={(e) => setField("age", e.target.value)}
                placeholder="e.g. 2 years, 6 months"
                required
              />
            </label>

            <label className="m2-field">
              <span>Barangay</span>
              <select
                value={form.barangay}
                onChange={(e) => setField("barangay", e.target.value)}
                required
              >
                <option value="">Select Barangay</option>
                {BARANGAYS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>

            <label className="m2-field">
              <span>Farmer Name</span>
              <input
                value={form.farmerName}
                onChange={(e) => setField("farmerName", e.target.value)}
                placeholder="Owner / Farmer Name"
                required
              />
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Scheduling
            </div>

            <label className="m2-field">
              <span>Protocol</span>
              <select
                value={form.protocol}
                onChange={(e) => setField("protocol", e.target.value)}
              >
                <option>PGF2α</option>
                <option>CIDR</option>
                <option>PG600</option>
                <option>Natural Heat</option>
              </select>
            </label>

            <label className="m2-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="m2-field">
              <span>Start Date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                required
              />
            </label>

            <label className="m2-field">
              <span>Target AI Date</span>
              <input
                type="date"
                value={form.targetAI}
                onChange={(e) => setField("targetAI", e.target.value)}
                required
              />
            </label>

            <label className="m2-field" style={{ gridColumn: "1 / -1" }}>
              <span>Remarks</span>
              <input
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
                placeholder="Optional remarks"
              />
            </label>
          </div>

          <div className="m2-formActions">
            <button
              className="m2-btn ghost"
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="m2-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}