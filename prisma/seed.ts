import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

function nextDayOfWeek(from: Date, dayOfWeek: number) {
  let d = startOfDay(from);
  while (d.getDay() !== dayOfWeek) d = addDays(d, 1);
  return d;
}

const prisma = new PrismaClient();

async function main() {
  const appointmentType = await prisma.appointmentType.upsert({
    where: { name: "Allenamento con Personal Trainer" },
    update: {},
    create: {
      name: "Allenamento con Personal Trainer",
      durationMinutes: 60,
      capacity: 6,
      requiresApproval: true,
    },
  });

  const adminEmail = "admin@palestra.local";
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: adminPasswordHash, name: "Admin Palestra" },
  });

  // Orario settimanale di default: Lun-Ven 09:00-17:00 con pausa pranzo
  // 13:00-14:00, weekend chiuso. Modificabile dall'admin in /admin/schedule
  // (Prompt Master 3.3 e 7).
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const isOpen = dayOfWeek >= 1 && dayOfWeek <= 5;
    const data = {
      appointmentTypeId: appointmentType.id,
      dayOfWeek,
      isOpen,
      openTime: "09:00",
      closeTime: "17:00",
      breakStart: isOpen ? "13:00" : null,
      breakEnd: isOpen ? "14:00" : null,
    };
    await prisma.weeklySchedule.upsert({
      where: { appointmentTypeId_dayOfWeek: { appointmentTypeId: appointmentType.id, dayOfWeek } },
      update: data,
      create: data,
    });
  }

  // Secondo calendario di esempio, per dimostrare la gestione di piu'
  // collaboratori/servizi in parallelo (richiesta utente).
  const secondType = await prisma.appointmentType.upsert({
    where: { name: "Consulenza Nutrizionale" },
    update: {},
    create: {
      name: "Consulenza Nutrizionale",
      durationMinutes: 30,
      capacity: 1,
      requiresApproval: false,
    },
  });
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const isOpen = dayOfWeek === 2 || dayOfWeek === 4; // Martedi' e Giovedi'
    const data = {
      appointmentTypeId: secondType.id,
      dayOfWeek,
      isOpen,
      openTime: "15:00",
      closeTime: "18:00",
    };
    await prisma.weeklySchedule.upsert({
      where: { appointmentTypeId_dayOfWeek: { appointmentTypeId: secondType.id, dayOfWeek } },
      update: data,
      create: data,
    });
  }

  const client1Data = {
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario.rossi@example.com",
    status: "ACTIVE",
    clientKind: "PRIVATO",
    fiscalCode: "RSSMRA85M01H501Z",
    address: "Via Roma 10",
    zipCode: "00100",
    city: "Roma",
    province: "RM",
    country: "IT",
  };
  const client1 = await prisma.client.upsert({
    where: { email: client1Data.email },
    update: client1Data,
    create: client1Data,
  });
  const client2 = await prisma.client.upsert({
    where: { email: "giulia.bianchi@example.com" },
    update: {},
    create: { firstName: "Giulia", lastName: "Bianchi", email: "giulia.bianchi@example.com", status: "PAUSED" },
  });

  // Listino ed esempio di profilo di fatturazione "per accessi effettivi"
  // (richiesto esplicitamente dall'utente).
  const priceItem = await prisma.priceListItem.upsert({
    where: { id: "seed-price-ingresso-singolo" },
    update: { name: "Ingresso singolo", unitPrice: 15, vatRate: 22, vatNature: null },
    create: {
      id: "seed-price-ingresso-singolo",
      name: "Ingresso singolo",
      description: "Prezzo per singolo accesso in palestra",
      unitPrice: 15,
      vatRate: 22,
    },
  });
  await prisma.billingProfile.upsert({
    where: { clientId: client1.id },
    update: { priceListItemId: priceItem.id, billingType: "PER_ACCESS", active: true },
    create: { clientId: client1.id, priceListItemId: priceItem.id, billingType: "PER_ACCESS", active: true },
  });

  const tomorrow = addDays(startOfDay(new Date()), 1);
  const slot10 = setMinutes(setHours(tomorrow, 10), 0);

  await prisma.booking.upsert({
    where: { koalendarBookingId: "seed-booking-1" },
    update: {},
    create: {
      koalendarBookingId: "seed-booking-1",
      clientId: client1.id,
      appointmentTypeId: appointmentType.id,
      startTime: slot10,
      endTime: setMinutes(setHours(tomorrow, 11), 0),
      status: "APPROVED",
      source: "koalendar_webhook",
    },
  });

  await prisma.booking.upsert({
    where: { koalendarBookingId: "seed-booking-2" },
    update: {},
    create: {
      koalendarBookingId: "seed-booking-2",
      clientId: client2.id,
      appointmentTypeId: appointmentType.id,
      startTime: slot10,
      endTime: setMinutes(setHours(tomorrow, 11), 0),
      status: "PENDING_APPROVAL",
      source: "koalendar_webhook",
    },
  });

  // Presenze passate per Mario Rossi, per dimostrare la fatturazione "per
  // accessi effettivi": 3 accessi nel mese scorso, di cui uno segnato assente.
  const lastMonth = addDays(startOfDay(new Date()), -20);
  for (let i = 0; i < 3; i++) {
    const day = addDays(lastMonth, i * 2);
    const start = setMinutes(setHours(day, 9 + i), 0);
    const attendanceData = {
      koalendarBookingId: `seed-attendance-${i}`,
      clientId: client1.id,
      appointmentTypeId: appointmentType.id,
      startTime: start,
      endTime: setMinutes(setHours(day, 10 + i), 0),
      status: "APPROVED",
      source: "custom",
      attended: i < 2, // due presenze, un'assenza
      attendedAt: i < 2 ? start : null,
    };
    await prisma.booking.upsert({
      where: { koalendarBookingId: `seed-attendance-${i}` },
      update: attendanceData,
      create: attendanceData,
    });
  }

  // Esempio di override puntuale (richiesta utente): "mercoledi' disattiva lo
  // slot delle 10 e quello delle 16" + "tra 3 settimane, un solo posto alle 11".
  const nextWednesday = nextDayOfWeek(addDays(new Date(), 1), 3);
  await prisma.slotOverride.upsert({
    where: { appointmentTypeId_date_time: { appointmentTypeId: appointmentType.id, date: nextWednesday, time: "10:00" } },
    update: { isDisabled: true, capacity: null },
    create: { appointmentTypeId: appointmentType.id, date: nextWednesday, time: "10:00", isDisabled: true },
  });
  await prisma.slotOverride.upsert({
    where: { appointmentTypeId_date_time: { appointmentTypeId: appointmentType.id, date: nextWednesday, time: "16:00" } },
    update: { isDisabled: true, capacity: null },
    create: { appointmentTypeId: appointmentType.id, date: nextWednesday, time: "16:00", isDisabled: true },
  });

  const inThreeWeeks = addDays(startOfDay(new Date()), 21);
  await prisma.slotOverride.upsert({
    where: { appointmentTypeId_date_time: { appointmentTypeId: appointmentType.id, date: inThreeWeeks, time: "11:00" } },
    update: { isDisabled: false, capacity: 1 },
    create: { appointmentTypeId: appointmentType.id, date: inThreeWeeks, time: "11:00", capacity: 1 },
  });

  console.log("Seed completato.");
  console.log(`Admin: ${adminEmail} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
