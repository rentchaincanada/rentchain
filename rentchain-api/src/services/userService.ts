import { v4 as uuidv4 } from "uuid";
import { firestore } from "../config/firebase";
import { User } from "../types/user";

const COLLECTION = "users";

export async function createUser(
  email: string,
  passwordHash: string
): Promise<User> {
  const id = uuidv4();
  const user: User = {
    id,
    email,
    passwordHash,
    plan: "starter",
    createdAt: new Date().toISOString(),
    twoFactorEnabled: false,
    twoFactorMethods: [],
    totpSecret: null,
    backupCodes: [],
  };
  await firestore.collection(COLLECTION).doc(id).set(user);
  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const snap = await firestore
    .collection(COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data() as User;
}

export async function findUserById(userId: string): Promise<User | null> {
  const doc = await firestore.collection(COLLECTION).doc(userId).get();
  return doc.exists ? (doc.data() as User) : null;
}
