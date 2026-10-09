/**
 * Bootstrap the first administrator on a fresh (e.g. production) database
 * without loading demo data.
 *
 *   npm run admin:create -- <email> "<full name>" <temporary-password>
 *
 * The account is flagged to change its password on first sign-in.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validatePasswordStrength } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: npm run admin:create -- <email> "<full name>" <temporary-password>');
    process.exit(1);
  }
  const weak = validatePasswordStrength(password);
  if (weak) {
    console.error(weak);
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) {
    console.error(`A user with email ${normalized} already exists.`);
    process.exit(1);
  }
  await prisma.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  console.log(`Admin ${normalized} created. They will be asked to change the password on first sign-in.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
