import { ensureSeedData } from "../lib/defaults";
import { prisma } from "../lib/prisma";

async function main() {
  await ensureSeedData();
  console.log("Seeded Pangpang reward app defaults.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
