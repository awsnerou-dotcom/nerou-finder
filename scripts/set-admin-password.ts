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
// If the email doesn't exist yet, this creates a new SUPER_ADMIN account with it instead of
// failing - lets an operator stand up a personal admin login without a separate signup step.
//
// Usage (run from the Render Shell tab, where DATABASE_URL is already set):
//   npx tsx scripts/set-admin-password.ts <email> <newPassword> [fullName]
//
// Examples:
//   npx tsx scripts/set-admin-password.ts super_admin@nerou.com "MyNewStrongP@ssw0rd!"
//   npx tsx scripts/set-admin-password.ts me@example.com "MyNewStrongP@ssw0rd!" "My Name"

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

async function main() {
  const [, , email, newPassword, fullName] = process.argv;

  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/set-admin-password.ts <email> <newPassword> [fullName]");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const row = await prisma.user.findUnique({ where: { email } });
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    if (row) {
      const userData = JSON.parse(row.data);
      userData.password = passwordHash;
      await prisma.user.update({
        where: { email },
        data: { data: JSON.stringify(userData) }
      });
      console.log(`Password set for ${email} (role: ${userData.role}). You can now log in with the new password.`);
      return;
    }

    const userId = `user-${Date.now()}`;
    const userData = {
      id: userId,
      email,
      password: passwordHash,
      fullName: fullName || email.split("@")[0],
      phone: "",
      role: "SUPER_ADMIN",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80",
      bio: "Administrator account.",
      languages: ["English", "Arabic"],
      verificationStatus: "APPROVED",
      createdDate: new Date().toISOString()
    };

    await prisma.user.create({
      data: { id: userId, email, role: "SUPER_ADMIN", data: JSON.stringify(userData) }
    });

    console.log(`New SUPER_ADMIN account created for ${email}. You can now log in with the password you set.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to set password:", err);
  process.exit(1);
});
