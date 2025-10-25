/*
 Provision admin users in Firebase Authentication and set Firestore roles.

 Usage (PowerShell):
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\service-account.json";
   $env:ADMIN_DEFAULT_PASSWORD="<password>";
   $env:ADMINS_CSV="email1@example.com,email2@example.com";
   npm run provision:admins

 Notes:
 - Requires a Firebase service account with Owner/Editor permissions.
 - This script WILL NOT store plaintext passwords in Firestore for security reasons.
   Firebase Authentication already stores passwords securely (hashed+salted).
*/

const admin = require("firebase-admin");

function getEnv(name, fallback) {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("GOOGLE_APPLICATION_CREDENTIALS is not set. Point it to a service account JSON file.");
    process.exit(1);
  }
  const password = getEnv("ADMIN_DEFAULT_PASSWORD", "");
  if (!password) {
    console.error("ADMIN_DEFAULT_PASSWORD is required.");
    process.exit(1);
  }
  const defaults = [
    "bridgeredsea@gmail.com",
    "birmanalon@gmail.com",
    "moranbirman23@gmail.com",
    "moranb@energix-group.com",
    "liapet1212@gmail.com",
  ];
  const emailsCsv = getEnv("ADMINS_CSV", defaults.join(","));
  const emails = emailsCsv.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const auth = admin.auth();
  const firestore = admin.firestore();

  for (const email of emails) {
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        userRecord = await auth.updateUser(userRecord.uid, { password, disabled: false, emailVerified: true });
        console.log(`Updated password for ${email}`);
      } catch (e) {
        if (String(e.message || e).includes("no user record")) {
          userRecord = await auth.createUser({ email, password, disabled: false, emailVerified: true });
          console.log(`Created user ${email}`);
        } else {
          throw e;
        }
      }
      // Firestore users/{email}
      const docRef = firestore.collection("users").doc(email);
      await docRef.set({
        email,
        uid: userRecord.uid,
        role: "admin",
        admin: true,
        allowed: true,
        provisionedAt: new Date().toISOString(),
      }, { merge: true });
      console.log(`Set admin role in Firestore for ${email}`);

      // SECURITY: Do not store plaintext password in Firestore.
      // If you insist on tracking resets, store only metadata (e.g., lastPasswordSetAt timestamp).
      await docRef.set({ lastPasswordSetAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error(`Failed provisioning ${email}:`, err);
    }
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
