import { PrismaClient } from "@prisma/client"

// "Zack Dezenzo" was a misspelled duplicate of Zach Dezenzo carrying a pitcher's MLB ID
// (700270, Yilber Díaz). Nobody picked it. Deletes it only if that is still true.
const prisma = new PrismaClient()

async function main() {
  const duplicate = await prisma.player.findFirst({
    where: { fullName: "Zack Dezenzo" },
    include: { _count: { select: { entryPlayers: true, optimalPlayers: true } } },
  })

  if (!duplicate) return console.log("Already removed.")
  if (duplicate._count.entryPlayers > 0 || duplicate._count.optimalPlayers > 0) {
    throw new Error("Zack Dezenzo is referenced by an entry or optimal lineup; not deleting.")
  }

  await prisma.player.delete({ where: { id: duplicate.id } })
  console.log(`Deleted duplicate player ${duplicate.id}.`)
}

main().finally(() => prisma.$disconnect())
