import { useEffect, useMemo, useState } from "react";
import "../../styles/p2Module.css";
import { Plus, Search, Syringe, X } from "lucide-react";

import { db } from "../../services/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

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
  estrusId: "",
  reportMonth: "",
  animalId: "",
  animalTagId: "",
  species: "",
  breed: "",
  color: "",
  sex: "",
  barangay: "",
  farmerName: "",
  aiDate: "",
  noOfStrawUsed: 1,
  estrus: "",
  sireBreed: "",
  sireCode: "",
  technician: "",
  remarks: "",
};

export default function P2Insemination() {
  const [rows, setRows] = useState([]);
  const [estrusRows, setEstrusRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingEstrus, setLoadingEstrus] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [estrusError, setEstrusError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const qAI = query(collection(db, "program2_ai"), orderBy("aiDate", "desc"));
    const unsubAI = onSnapshot(
      qAI,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRows(list);
        setRecordsError("");
        setLoadingRecords(false);
      },
      (error) => {
        console.error("Error loading AI records:", error);
        setRows([]);
        setRecordsError(error?.message || "Failed to load AI records.");
        setLoadingRecords(false);
      }
    );

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
        setEstrusRows(list);
        setEstrusError("");
        setLoadingEstrus(false);
      },
      (error) => {
        console.error("Error loading estrus records:", error);
        setEstrusRows([]);
        setEstrusError(error?.message || "Failed to load estrus records.");
        setLoadingEstrus(false);
      }
    );

    return () => {
      unsubAI();
      unsubEstrus();
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const hay =
        `${r.animalTagId || ""} ${r.barangay || ""} ${r.technician || ""} ${r.sireBreed || ""} ${r.sireCode || ""} ${r.species || ""} ${r.breed || ""} ${r.farmerName || ""}`.toLowerCase();
      return !q.trim() ? true : hay.includes(q.toLowerCase());
    });
  }, [rows, q]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleEstrusSelect = (estrusId) => {
    const selected = estrusRows.find((r) => r.id === estrusId);

    if (!selected) {
      resetForm();
      return;
    }

    setForm((prev) => ({
      ...prev,
      estrusId: selected.id,
      reportMonth: selected.reportMonth || "",
      animalId: selected.animalId || "",
      animalTagId: selected.animalTagId || "",
      species: selected.species || "",
      breed: selected.breed || "",
      color: selected.color || "",
      sex: selected.sex || "",
      barangay: selected.barangay || "",
      farmerName: selected.farmerName || "",
      aiDate: prev.aiDate,
      noOfStrawUsed: prev.noOfStrawUsed,
      estrus: prev.estrus,
      sireBreed: prev.sireBreed,
      sireCode: prev.sireCode,
      technician: prev.technician,
      remarks: prev.remarks,
    }));
  };

  const validateForm = () => {
    if (!form.estrusId) return "Please select an estrus record.";
    if (!form.aiDate) return "AI Date is required.";
    if (!form.noOfStrawUsed || Number(form.noOfStrawUsed) <= 0) {
      return "No. of AI Straw Used is required.";
    }
    if (!form.estrus.trim()) return "Estrus is required.";
    if (!form.sireBreed.trim()) return "Sire Breed is required.";
    if (!form.sireCode.trim()) return "Sire Code is required.";
    if (!form.technician.trim()) return "Technician is required.";
    return "";
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

      await addDoc(collection(db, "program2_ai"), {
        estrusId: form.estrusId,
        animalId: form.animalId,
        reportMonth: form.reportMonth,
        animalTagId: form.animalTagId,
        species: form.species,
        breed: form.breed,
        color: form.color,
        sex: form.sex,
        barangay: form.barangay,
        farmerName: form.farmerName,

        aiDate: form.aiDate,
        noOfStrawUsed: Number(form.noOfStrawUsed),
        estrus: form.estrus.trim(),
        sireBreed: form.sireBreed.trim(),
        sireCode: form.sireCode.trim(),
        technician: form.technician.trim(),
        remarks: form.remarks.trim(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error saving AI record:", error);
      alert(error?.message || "Failed to save AI record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="m2">
      <div className="m2-head">
        <div>
          <div className="m2-h1">
            <Syringe size={18} /> Artificial Insemination
          </div>
          <div className="m2-sub">
            Select animal identification from estrus records, then encode insemination details.
          </div>
        </div>

        <button className="m2-btn" onClick={() => setOpen(true)} type="button">
          <Plus size={16} /> Add AI Record
        </button>
      </div>

      <div className="m2-toolbar">
        <div className="m2-search">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search animal, barangay, technician, sire..."
          />
        </div>
      </div>

      {recordsError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">AI records error: {recordsError}</div>
        </div>
      )}

      {estrusError && (
        <div className="m2-card" style={{ marginBottom: 12 }}>
          <div className="m2-emptyRow">Estrus records error: {estrusError}</div>
        </div>
      )}

      <div className="m2-card">
        <div className="m2-cardHead">
          <div className="m2-cardTitle">Artificial Insemination Records</div>
          <div className="m2-cardHint">
            {loadingRecords ? "Loading..." : `${filtered.length} result(s)`}
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
                <th>BRGY</th>
                <th>Farmer</th>
                <th>AI Date</th>
                <th>Straw Used</th>
                <th>Estrus</th>
                <th>Sire Breed</th>
                <th>Sire Code</th>
                <th>Technician</th>
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
                  <td>{r.barangay}</td>
                  <td>{r.farmerName}</td>
                  <td>{r.aiDate}</td>
                  <td>{r.noOfStrawUsed}</td>
                  <td>{r.estrus}</td>
                  <td>{r.sireBreed}</td>
                  <td>{r.sireCode}</td>
                  <td>{r.technician}</td>
                </tr>
              ))}
              {!loadingRecords && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="m2-emptyRow">
                    No AI records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="Add Artificial Insemination Record"
        onClose={() => setOpen(false)}
      >
        <form className="m2-form" onSubmit={add}>
          <div className="m2-grid">
            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginBottom: 4 }}>
              Select Existing Animal Identification / Estrus Record
            </div>

            <label className="m2-field" style={{ gridColumn: "1 / -1" }}>
              <span>Estrus Record</span>
              <select
                value={form.estrusId}
                onChange={(e) => handleEstrusSelect(e.target.value)}
                required
                disabled={loadingEstrus || !!estrusError}
              >
                <option value="">Select record</option>
                {estrusRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reportMonth || "-"} | {r.animalTagId} | {r.species} | {r.breed} | {r.barangay} | {r.farmerName}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Animal Identification
            </div>

            <label className="m2-field">
              <span>Report Month</span>
              <input value={form.reportMonth} readOnly />
            </label>

            <label className="m2-field">
              <span>Animal ID No.</span>
              <input value={form.animalTagId} readOnly />
            </label>

            <label className="m2-field">
              <span>Species</span>
              <input value={form.species} readOnly />
            </label>

            <label className="m2-field">
              <span>Breed</span>
              <input value={form.breed} readOnly />
            </label>

            <label className="m2-field">
              <span>Color</span>
              <input value={form.color} readOnly />
            </label>

            <label className="m2-field">
              <span>BRGY</span>
              <input value={form.barangay} readOnly />
            </label>

            <label className="m2-field" style={{ gridColumn: "1 / -1" }}>
              <span>Name of Farmer</span>
              <input value={form.farmerName} readOnly />
            </label>

            <div style={{ gridColumn: "1 / -1", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>
              Artificial Insemination
            </div>

            <label className="m2-field">
              <span>Date</span>
              <input
                type="date"
                value={form.aiDate}
                onChange={(e) => setField("aiDate", e.target.value)}
                required
              />
            </label>

            <label className="m2-field">
              <span>No. of AI Straw Used</span>
              <input
                type="number"
                min="1"
                value={form.noOfStrawUsed}
                onChange={(e) => setField("noOfStrawUsed", e.target.value)}
                required
              />
            </label>

            <label className="m2-field">
              <span>Estrus</span>
              <input
                value={form.estrus}
                onChange={(e) => setField("estrus", e.target.value)}
                placeholder="e.g. Standing heat"
                required
              />
            </label>

            <label className="m2-field">
              <span>Sire Breed</span>
              <input
                value={form.sireBreed}
                onChange={(e) => setField("sireBreed", e.target.value)}
                placeholder="e.g. Brahman"
                required
              />
            </label>

            <label className="m2-field">
              <span>Sire Code</span>
              <input
                value={form.sireCode}
                onChange={(e) => setField("sireCode", e.target.value)}
                placeholder="e.g. BR-001"
                required
              />
            </label>

            <label className="m2-field">
              <span>Technician</span>
              <input
                value={form.technician}
                onChange={(e) => setField("technician", e.target.value)}
                placeholder="Technician name"
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
              {saving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}