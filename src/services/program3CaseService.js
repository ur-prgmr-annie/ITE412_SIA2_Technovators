// src/services/program3CaseService.js
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  where,
  limit,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";

const CASES_COLLECTION = "program3_cases";

// ✅ FIXED: Simple query without ordering to avoid assertion errors
export const subscribeToCases = (callback) => {
  try {
    // Option 1: Simple query - no orderBy to avoid index issues
    const q = query(collection(db, CASES_COLLECTION));

    return onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side instead
      const sorted = cases.sort((a, b) => {
        if (a.reportedDate > b.reportedDate) return -1;
        if (a.reportedDate < b.reportedDate) return 1;
        return 0;
      });
      callback(sorted);
    }, (error) => {
      console.error("Error in subscribeToCases:", error);
      callback([]);
    });
  } catch (error) {
    console.error("Error setting up subscription:", error);
    callback([]);
    return () => {};
  }
};

// ✅ Alternative: Query with orderBy (requires index)
export const subscribeToCasesOrdered = (callback) => {
  try {
    // This requires a composite index in Firestore
    const q = query(
      collection(db, CASES_COLLECTION),
      orderBy("reportedDate", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(cases);
    }, (error) => {
      console.error("Error in subscribeToCasesOrdered:", error);
      // Fallback to simple query
      subscribeToCases(callback);
    });
  } catch (error) {
    console.error("Error setting up subscription:", error);
    callback([]);
    return () => {};
  }
};

// Add new case
export const addCaseToFirestore = async (caseData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to add a case");
    
    // Validate required fields
    if (!caseData.disease) throw new Error("Disease is required");
    if (!caseData.species) throw new Error("Species is required");
    if (!caseData.barangay) throw new Error("Barangay is required");
    if (!caseData.reportedDate) throw new Error("Reported date is required");
    if (!caseData.status) throw new Error("Status is required");
    if (!caseData.severity) throw new Error("Severity is required");
    
    // Ensure symptoms is an array
    const symptoms = Array.isArray(caseData.symptoms) 
      ? caseData.symptoms 
      : caseData.symptoms?.split?.(',').map(s => s.trim()).filter(Boolean) || [];
    
    if (symptoms.length === 0) throw new Error("At least one symptom is required");
    
    // Create the document data with all required fields
    const docData = {
      disease: caseData.disease,
      species: caseData.species,
      barangay: caseData.barangay,
      reportedDate: caseData.reportedDate,
      status: caseData.status || "reported",
      severity: caseData.severity || "medium",
      symptoms: symptoms,
      reporter: caseData.reporter || "—",
      notes: caseData.notes || "",
      createdBy: user.uid,
      createdByEmail: user.email || user.displayName || "Unknown",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, CASES_COLLECTION), docData);
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error("Error adding case:", error);
    throw new Error(`Failed to add case: ${error.message}`);
  }
};

// Update a case
export const updateCaseInFirestore = async (caseId, updateData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to update a case");
    
    const docRef = doc(db, CASES_COLLECTION, caseId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedByEmail: user.email
    });
    return { id: caseId, ...updateData };
  } catch (error) {
    console.error("Error updating case:", error);
    throw new Error(`Failed to update case: ${error.message}`);
  }
};

// Delete a case
export const deleteCaseFromFirestore = async (caseId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to delete a case");
    
    const docRef = doc(db, CASES_COLLECTION, caseId);
    await deleteDoc(docRef);
    return { id: caseId };
  } catch (error) {
    console.error("Error deleting case:", error);
    throw new Error(`Failed to delete case: ${error.message}`);
  }
};

// Get a single case by ID
export const getCaseById = async (caseId) => {
  try {
    const docRef = doc(db, CASES_COLLECTION, caseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting case:", error);
    throw error;
  }
};

// Get cases by barangay
export const getCasesByBarangay = async (barangay) => {
  try {
    const q = query(
      collection(db, CASES_COLLECTION),
      where("barangay", "==", barangay)
    );
    const snapshot = await getDocs(q);
    const cases = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Sort client-side
    return cases.sort((a, b) => {
      if (a.reportedDate > b.reportedDate) return -1;
      if (a.reportedDate < b.reportedDate) return 1;
      return 0;
    });
  } catch (error) {
    console.error("Error getting cases by barangay:", error);
    throw error;
  }
};

// Get cases by disease
export const getCasesByDisease = async (disease) => {
  try {
    const q = query(
      collection(db, CASES_COLLECTION),
      where("disease", "==", disease)
    );
    const snapshot = await getDocs(q);
    const cases = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Sort client-side
    return cases.sort((a, b) => {
      if (a.reportedDate > b.reportedDate) return -1;
      if (a.reportedDate < b.reportedDate) return 1;
      return 0;
    });
  } catch (error) {
    console.error("Error getting cases by disease:", error);
    throw error;
  }
};