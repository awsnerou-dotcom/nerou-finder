/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// One-time recovery tool for accounts locked out by the login fix that now requires every
// account to have a real password hash (server.ts's /api/auth/login rejects any account with
// no `password` field - previously that same condition let anyone log in as that account with
// any password, which was the actual vulnerability being fixed). Seeded admin accounts
// (SUPER_ADMIN, PLATFORM_ADMIN, etc. in server-db.ts's DEFAULT_USERS) never had a password set,
// so they need one written directly to the database once. Not an HTTP endpoint - deliberately
// run by hand from a trusted shell only, so it adds no new attack surface to the running app.
//
// Usage (run from the Render Shell tab, where DATABASE_URL is already set):
//   npx tsx scripts/set-admin-password.ts <email> <newPassword>
//
// Example:
//   npx tsx scripts/set-admin-password.ts super_admin@nerou.com "MyNewStrongP@ssw0rd!"

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/set-admin-password.ts <email> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) {
      console.error(`No user found with email "${email}".`);
      process.exit(1);
    }

    const userData = JSON.parse(row.data);
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    userData.password = passwordHash;

    await prisma.user.update({
      where: { email },
      data: { data: JSON.stringify(userData) }
    });

    console.log(`Password set for ${email} (role: ${userData.role}). You can now log in with the new password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to set password:", err);
  process.exit(1);
});
