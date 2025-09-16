import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; 

export async function createUserProfile(userId: string) {
  await setDoc(doc(db, "user_profiles", userId), {
    email: "writeoffapp@gmail.com",
    name: "Hemant",
    profession: "Software Developer",
    income: 60000,
    state: "AZ",
    filing_status: "single",
    plaid_token: "sandbox-xyz",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
}
