import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash(process.env.SEED_ADMIN_PASSWORD || "FuzionAdmin2026!", 12);

  // Seed admin users
  const roei = await prisma.user.upsert({
    where: { email: "roei@fuzionwebz.com" },
    update: {},
    create: {
      email: "roei@fuzionwebz.com",
      name: "Roei Yehezkel",
      passwordHash,
      role: "ADMIN",
    },
  });

  const elad = await prisma.user.upsert({
    where: { email: "elad@fuzionwebz.com" },
    update: {},
    create: {
      email: "elad@fuzionwebz.com",
      name: "Elad Nissim",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seeded users:", { roei: roei.id, elad: elad.id });

  // Seed projects
  const project1 = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: {},
    create: {
      id: "seed-project-1",
      name: "Corporate Website Redesign",
      client: "Acme Corp",
      description: "Full redesign of the corporate website with modern UI/UX",
      status: "ACTIVE",
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: "seed-project-2" },
    update: {},
    create: {
      id: "seed-project-2",
      name: "E-Commerce Platform",
      client: "ShopStar",
      description: "Build a custom e-commerce platform with inventory management",
      status: "ACTIVE",
    },
  });

  console.log("Seeded projects:", { project1: project1.id, project2: project2.id });

  // Seed tasks
  const tasks = await Promise.all([
    prisma.task.upsert({
      where: { id: "seed-task-1" },
      update: {},
      create: {
        id: "seed-task-1",
        title: "Design homepage wireframes",
        description: "Create wireframes for the new homepage layout",
        status: "IN_PROGRESS",
        priority: "HIGH",
        order: 0,
        tags: ["design", "homepage"],
        projectId: project1.id,
        assigneeId: roei.id,
        creatorId: elad.id,
      },
    }),
    prisma.task.upsert({
      where: { id: "seed-task-2" },
      update: {},
      create: {
        id: "seed-task-2",
        title: "Set up CI/CD pipeline",
        description: "Configure GitHub Actions for automated deployment",
        status: "TODO",
        priority: "MEDIUM",
        order: 1,
        tags: ["devops", "infrastructure"],
        projectId: project1.id,
        assigneeId: elad.id,
        creatorId: roei.id,
      },
    }),
    prisma.task.upsert({
      where: { id: "seed-task-3" },
      update: {},
      create: {
        id: "seed-task-3",
        title: "Build product catalog API",
        description: "REST API for product listing, filtering, and search",
        status: "TODO",
        priority: "URGENT",
        order: 0,
        tags: ["backend", "api"],
        projectId: project2.id,
        assigneeId: elad.id,
        creatorId: roei.id,
      },
    }),
    prisma.task.upsert({
      where: { id: "seed-task-4" },
      update: {},
      create: {
        id: "seed-task-4",
        title: "Implement shopping cart",
        description: "Frontend shopping cart with local storage persistence",
        status: "TODO",
        priority: "HIGH",
        order: 1,
        tags: ["frontend", "feature"],
        projectId: project2.id,
        assigneeId: roei.id,
        creatorId: elad.id,
      },
    }),
  ]);

  console.log("Seeded tasks:", tasks.map((t) => t.id));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
