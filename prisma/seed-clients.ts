import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const clients = [
  { number: 1, name: "דפני פיזיותרפיה", status: "בוצע", notes: "Disaster", amount: 89, expense: null },
  { number: 2, name: "דוריאל יוגה", status: "בוצע", notes: "Disaster", amount: 57, expense: null },
  { number: 3, name: "לילה יוגה (שיר)", status: "בוצע", notes: "Disaster", amount: 70, expense: null },
  { number: 4, name: "דני רואה חשבון", status: "בוצע", notes: "Disaster", amount: 59, expense: null },
  { number: 5, name: "אינר קוסמוס", status: "בוצע", notes: "Disaster", amount: 152, expense: null },
  { number: 6, name: "אינר ווארד", status: "בוצע", notes: "Disaster", amount: 152, expense: null },
  { number: 7, name: "אלי אלוני", status: "בוצע", notes: "Solt", amount: 300, expense: null },
  { number: 8, name: "משה עורך דין", status: "בוצע", notes: "FuzionWeb", amount: 60, expense: 30 },
  { number: 9, name: "חן", status: "בוצע", notes: "Disaster", amount: 59, expense: null },
  { number: 10, name: "יהל", status: "בוצע", notes: "Disaster", amount: 49, expense: null },
  { number: 11, name: "דנטלקייר", status: "בוצע", notes: "FuzionWeb", amount: 140.6, expense: 70.3 },
  { number: 12, name: "מורן", status: "בוצע", notes: "FuzionWeb", amount: 118, expense: null },
  { number: 13, name: "עולם הממתקים", status: "בוצע", notes: "FuzionWeb", amount: 82.6, expense: 41.3 },
  { number: 14, name: "טיפטים", status: "בוצע", notes: "FuzionWeb", amount: 118, expense: 59 },
  { number: 15, name: "טיקטס", status: "בוצע", notes: "FuzionWeb", amount: 531, expense: 330 },
  { number: 16, name: "נתן ארט", status: "חצי", notes: "FuzionWeb", amount: 118, expense: 59 },
  { number: 17, name: "עמק איילון", status: "", notes: "FuzionWeb", amount: null, expense: null },
  { number: 18, name: "רוזה", status: "", notes: "FuzionWeb", amount: null, expense: null },
  { number: 19, name: "jumarie", status: "בוצע", notes: "FuzionWeb", amount: 236, expense: 118 },
  { number: 20, name: "bingo", status: "", notes: "FuzionWeb", amount: null, expense: 590 },
  { number: 21, name: "יוני המבורגר", status: "", notes: "FuzionWeb", amount: null, expense: 59 },
  { number: 22, name: "יוני שווארמה", status: "בוצע", notes: "FuzionWeb", amount: 118, expense: 59 },
  { number: 23, name: "אריאלה ביוטי", status: "", notes: "FuzionWeb", amount: null, expense: null },
];

async function main() {
  console.log("Seeding clients...");

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: `seed-client-${client.number}` },
      update: {
        name: client.name,
        status: client.status,
        notes: client.notes,
        amount: client.amount,
        expense: client.expense,
      },
      create: {
        id: `seed-client-${client.number}`,
        number: client.number,
        name: client.name,
        status: client.status,
        notes: client.notes,
        amount: client.amount,
        expense: client.expense,
      },
    });
  }

  console.log(`Seeded ${clients.length} clients.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
