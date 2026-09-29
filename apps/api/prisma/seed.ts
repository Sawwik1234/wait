// ============================================================
// CaseArena seed: 38 fictional items, 8 cases with exact-RTP weight
// solving, bots, admin & demo accounts.
// Run: DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts
// ============================================================
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';
import { solveCaseWeights, tableEv } from '../src/common/economy';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'MYTHIC';

interface ItemDef {
  slug: string;
  name: string;
  image: string;
  rarity: Rarity;
  value: number;
  kind: 'WEAPON' | 'KNIFE' | 'GEAR';
}

const R = (slug: string, name: string, rarity: Rarity, value: number): ItemDef => ({
  slug,
  name,
  image: `/items/${slug}.png`,
  rarity,
  value,
  kind: 'WEAPON',
});
const K = (slug: string, name: string, rarity: Rarity, value: number): ItemDef => ({
  ...R(slug, name, rarity, value),
  kind: 'KNIFE',
});

const ITEMS: ItemDef[] = [
  // ---- junk (economy floor: enables low-price case EV) ----
  { slug: 'j1', name: 'Scrap Gear', image: '/items/j1.png', rarity: 'COMMON', value: 35, kind: 'GEAR' },
  { slug: 'j2', name: 'Dead Cell', image: '/items/j2.png', rarity: 'COMMON', value: 50, kind: 'GEAR' },
  { slug: 'j3', name: 'Cracked Lens', image: '/items/j3.png', rarity: 'COMMON', value: 65, kind: 'GEAR' },
  { slug: 'j4', name: 'Torn Holo', image: '/items/j4.png', rarity: 'COMMON', value: 25, kind: 'GEAR' },
  // ---- rifles ----
  R('r01', 'Scrap Rebel', 'COMMON', 120),
  R('r02', 'Cobalt Viper', 'COMMON', 150),
  R('r03', 'Cryo Arc', 'UNCOMMON', 320),
  R('r04', 'Jade Fang', 'UNCOMMON', 360),
  R('r05', 'Copperhead', 'RARE', 700),
  R('r06', 'Arctic Wolf', 'UNCOMMON', 300),
  R('r07', 'Crimson Carbon', 'RARE', 850),
  R('r08', 'Violet Pulse', 'RARE', 780),
  R('r09', 'Dune Scorpion', 'COMMON', 140),
  R('r10', 'Midas Touch', 'EPIC', 1600),
  R('r11', 'Obsidian Ghost', 'RARE', 900),
  R('r12', 'Teal Circuit', 'UNCOMMON', 340),
  R('r13', 'Hazard Zone', 'COMMON', 130),
  R('r14', 'Steel Titan', 'RARE', 720),
  R('r15', 'Hexweave', 'EPIC', 1500),
  R('r16', 'Emerald Phantom', 'MYTHIC', 4200),
  // ---- pistols & compacts ----
  R('p01', 'Iron Wisp', 'COMMON', 90),
  R('p02', 'Neon Fang', 'UNCOMMON', 260),
  R('p03', 'Silver Dart', 'COMMON', 110),
  R('p04', 'Toxin', 'RARE', 640),
  R('p05', 'Amber Royalty', 'UNCOMMON', 380),
  R('p06', 'Deep Circuit', 'RARE', 700),
  R('p07', 'Pearl Duchess', 'EPIC', 1400),
  R('p08', 'Shadow Ops', 'COMMON', 100),
  R('p09', 'Volt Storm', 'RARE', 680),
  R('p10', 'Bronze Legend', 'UNCOMMON', 350),
  R('p11', 'Holo Pulse', 'EPIC', 1350),
  R('p12', 'Blood Aria', 'MYTHIC', 3600),
  // ---- melee ----
  K('m01', 'Cyan Fang', 'RARE', 950),
  K('m02', 'Violet Dancer', 'RARE', 1050),
  K('m03', 'Ember Hatchet', 'UNCOMMON', 420),
  K('m04', 'Viridian Cleaver', 'EPIC', 1900),
  K('m05', 'Royal Sword', 'EPIC', 2400),
  K('m06', 'Void Reaver', 'MYTHIC', 7500),
];

interface CaseDef {
  slug: string;
  name: string;
  description: string;
  image: string;
  price: number;
  rtp: number;
  category: string;
  /** [itemSlug, baseWeight]; the cheapest entry's weight is auto-solved to hit exact EV */
  items: [string, number][];
}

const CASES: CaseDef[] = [
  {
    slug: 'starter-crate',
    name: 'Starter Crate',
    description: 'Начальный ящик: хлам и обычное оружие, маленький шанс на Neon Fang.',
    image: '/cases/c01.png',
    price: 100,
    rtp: 0.88,
    category: 'starter',
    items: [
      ['j4', 0], ['j1', 24], ['j2', 20], ['j3', 16], ['p01', 13], ['p03', 10],
      ['r01', 9], ['r13', 8], ['r09', 9], ['r02', 8], ['p02', 4],
    ],
  },
  {
    slug: 'copper-league',
    name: 'Copper League',
    description: 'Недорогой ящик с шансом на первый нож Ember Hatchet.',
    image: '/cases/c02.png',
    price: 250,
    rtp: 0.87,
    category: 'standard',
    items: [
      ['p01', 0], ['r13', 22], ['r01', 22], ['r02', 20], ['r09', 21],
      ['r06', 18], ['r12', 17], ['p10', 16], ['m03', 10],
    ],
  },
  {
    slug: 'neon-reef',
    name: 'Neon Reef',
    description: 'Неоновая глубина: uncommon-оружие и редкий шанс на Holo Pulse.',
    image: '/cases/c03.png',
    price: 400,
    rtp: 0.88,
    category: 'standard',
    items: [
      ['p02', 0], ['r06', 17], ['r03', 16], ['r12', 14], ['r04', 13],
      ['p05', 12], ['m03', 8], ['p11', 3],
    ],
  },
  {
    slug: 'crimson-vault',
    name: 'Crimson Vault',
    description: 'Хранилище редкостей: RARE-оружие и Viridian Cleaver на вершине.',
    image: '/cases/c04.png',
    price: 750,
    rtp: 0.93,
    category: 'pro',
    items: [
      ['p04', 0], ['p09', 20], ['r05', 19], ['p06', 18], ['r14', 17],
      ['r08', 12], ['r07', 10], ['m01', 5], ['m04', 1],
    ],
  },
  {
    slug: 'royal-court',
    name: 'Royal Court',
    description: 'Королевский двор: ножи, Pearl Duchess и Royal Sword как главный приз.',
    image: '/cases/c05.png',
    price: 1200,
    rtp: 0.9,
    category: 'pro',
    items: [
      ['r05', 0], ['r07', 18], ['r08', 20], ['r11', 20], ['m01', 18],
      ['m02', 20], ['p07', 22], ['m05', 8],
    ],
  },
  {
    slug: 'ghost-protocol',
    name: 'Ghost Protocol',
    description: 'Скрытность и тень: эпик-уровень наверху, Blood Aria — мечта коллекционера.',
    image: '/cases/c06.png',
    price: 1500,
    rtp: 0.89,
    category: 'pro',
    items: [
      ['r11', 0], ['m01', 16], ['m02', 15], ['p11', 13], ['r15', 12],
      ['p07', 12], ['r10', 10], ['m04', 7], ['p12', 1],
    ],
  },
  {
    slug: 'void-rafale',
    name: 'Void Rafale',
    description: 'Высокие ставки: Epic-пул и Mythic Void Reaver на дне вероятностей.',
    image: '/cases/c07.png',
    price: 2500,
    rtp: 0.91,
    category: 'elite',
    items: [
      ['m02', 0], ['r15', 17], ['r10', 16], ['m04', 16], ['m05', 34],
      ['r16', 12], ['m06', 1],
    ],
  },
  {
    slug: 'mythic-abyss',
    name: 'Mythic Abyss',
    description: 'Безодня мифики: только лучшее. Void Reaver ждёт своего владельца.',
    image: '/cases/c08.png',
    price: 3500,
    rtp: 0.92,
    category: 'elite',
    items: [
      ['p07', 0], ['r15', 14], ['r10', 15], ['m04', 12], ['p12', 22],
      ['m05', 20], ['r16', 34], ['m06', 10],
    ],
  },
];

const BOTS: { username: string; xp: number }[] = [
  { username: 'NeoHunter', xp: 61_200 },
  { username: 'VoidWalker', xp: 44_800 },
  { username: 'LuckyPunk', xp: 33_500 },
  { username: 'ShadowFox', xp: 27_300 },
  { username: 'CyberMasha', xp: 19_900 },
  { username: 'NoScope_22', xp: 14_600 },
  { username: 'МистерКейс', xp: 11_200 },
  { username: 'Prosto_Kot', xp: 8_400 },
  { username: 'KirillZZ', xp: 5_900 },
  { username: 'SkinsCollector', xp: 3_100 },
  { username: 'Дракон', xp: 1_700 },
  { username: 'Тапок', xp: 640 },
];

async function main() {
  console.log('[seed] start');

  // wipe gameplay tables (idempotent reseed)
  await prisma.ledger.deleteMany();
  await prisma.balance.deleteMany();
  await prisma.caseOpen.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.upgrade.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.dailyClaim.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.case.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  // ---- items ----
  for (const [i, def] of ITEMS.entries()) {
    await prisma.item.create({ data: { ...def, displayOrder: i } });
  }
  const items = await prisma.item.findMany();
  const bySlug = new Map(items.map((it) => [it.slug, it]));
  console.log(`[seed] items: ${items.length}`);

  // ---- cases with exact-RTP weight solving ----
  for (const [order, def] of CASES.entries()) {
    const entries = def.items.map(([slug]) => {
      const item = bySlug.get(slug)!;
      return { value: item.value, weight: def.items.find(([s]) => s === slug)![1] };
    });

    // buffer = cheapest entry in the case (must be cheaper than target EV)
    let bufferIdx = 0;
    entries.forEach((e, i) => {
      if (e.value < entries[bufferIdx]!.value) bufferIdx = i;
    });

    const targetEv = def.price * def.rtp;
    const solved = solveCaseWeights(entries, bufferIdx, targetEv);
    if (!solved) {
      throw new Error(`[seed] cannot solve EV for case ${def.slug} (target EV ${targetEv})`);
    }

    // weights are stored as integers — round and re-check
    const rounded = solved.map((w) => Math.max(1, Math.round(w)));
    const solvedEv = tableEv(entries.map((e, i) => ({ ...e, weight: rounded[i]! })));
    const drift = Math.abs(solvedEv - targetEv) / targetEv;
    if (drift > 0.02) {
      throw new Error(`[seed] EV drift too big for ${def.slug}: ${solvedEv.toFixed(1)} vs ${targetEv}`);
    }

    const created = await prisma.case.create({
      data: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        image: def.image,
        price: def.price,
        rtp: def.rtp,
        category: def.category,
        displayOrder: order,
      },
    });

    for (const [i, [slug]] of def.items.entries()) {
      await prisma.caseItem.create({
        data: {
          caseId: created.id,
          itemId: bySlug.get(slug)!.id,
          weight: rounded[i]!,
        },
      });
    }
    console.log(
      `[seed] case ${def.slug}: price=${def.price} ev=${solvedEv.toFixed(1)} ` +
        `rtp=${((solvedEv / def.price) * 100).toFixed(1)}% (target ${def.rtp * 100}%)`,
    );
  }

  // ---- admin ----
  const admin = await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@casearena.local',
      username: 'ArenaMaster',
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? 'Admin#12345'),
      role: 'SUPER_ADMIN',
      xp: 120_000,
    },
  });
  await prisma.balance.create({ data: { userId: admin.id, amount: 1_000_000 } });
  console.log(`[seed] admin: ${process.env.ADMIN_EMAIL ?? 'admin@casearena.local'}`);

  // ---- demo user ----
  const demo = await prisma.user.create({
    data: {
      email: 'demo@casearena.local',
      username: 'DemoPlayer',
      passwordHash: hashPassword('demo1234'),
      xp: 3_400,
    },
  });
  await prisma.balance.create({ data: { userId: demo.id, amount: 5_000 } });
  await prisma.ledger.create({
    data: { userId: demo.id, amount: 5_000, type: 'WELCOME_BONUS', balanceAfter: 5_000 },
  });
  console.log('[seed] demo user: demo@casearena.local / demo1234');

  // ---- bots with xp + starter inventories ----
  for (const [bi, bot] of BOTS.entries()) {
    const u = await prisma.user.create({
      data: {
        email: `bot${bi + 1}@bots.casearena.local`,
        username: bot.username,
        passwordHash: hashPassword(randomBytes(12).toString('hex')),
        isBot: true,
        xp: bot.xp,
      },
    });
    await prisma.balance.create({ data: { userId: u.id, amount: 500 } });

    const tier = bot.xp > 30_000 ? ['EPIC', 'MYTHIC', 'RARE'] : bot.xp > 10_000 ? ['RARE', 'EPIC', 'UNCOMMON'] : ['COMMON', 'UNCOMMON', 'RARE'];
    const picks = items.filter((it) => tier.includes(it.rarity));
    const n = 3 + (bot.xp % 5);
    for (let i = 0; i < n; i++) {
      const item = picks[(bot.xp + i * 7) % picks.length]!;
      await prisma.inventoryItem.create({
        data: { userId: u.id, itemId: item.id, sourceType: 'CASE_OPEN' },
      });
    }
  }
  console.log(`[seed] bots: ${BOTS.length}`);

  console.log('[seed] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
