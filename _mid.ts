import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.user.findUnique({ where: { username: "marcus" }, select: { id: true } }).then(u => { console.log(u!.id); return p.$disconnect(); });
