/**
 * Generate the SQL to insert your admin account into team_users.
 * Run once: node scripts/create-admin.mjs <email> <password> [name]
 */

import bcrypt from "bcryptjs";

const [email, password, name = "Admin"] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> [name]");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

console.log("\nRun this in Supabase SQL editor:\n");
console.log(
  `INSERT INTO team_users (name, email, password_hash, role)\nVALUES ('${name}', '${email.toLowerCase()}', '${hash}', 'admin');`
);
