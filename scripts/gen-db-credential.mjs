#!/usr/bin/env node
// Generate a random database password and its SCRAM-SHA-256 verifier.
//
//   node scripts/gen-db-credential.mjs <password-file>
//
// The plaintext password is written only to <password-file> (mode 0600); stdout
// prints only the verifier, which can be used in
//   ALTER ROLE crm_app WITH LOGIN PASSWORD '<verifier>';
// so the plaintext never appears in SQL, logs or chat. (RFC 5802 / RFC 7677,
// the format Postgres stores in pg_authid.)
import { createHash, createHmac, pbkdf2Sync, randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/gen-db-credential.mjs <password-file>");
  process.exit(1);
}

// Alphanumeric only: no SASLprep normalisation and no URL-encoding surprises.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const password = Array.from({ length: 40 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const iterations = 4096;
const salt = randomBytes(16);
const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const clientKey = createHmac("sha256", salted).update("Client Key").digest();
const storedKey = createHash("sha256").update(clientKey).digest();
const serverKey = createHmac("sha256", salted).update("Server Key").digest();

writeFileSync(file, password, { mode: 0o600 });
console.log(`SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`);
