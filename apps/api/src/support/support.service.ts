import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app.exception';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, input: { subject: string; category: string; text: string }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: { userId, subject: input.subject, category: input.category },
      });
      await tx.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: userId, isStaff: false, text: input.text },
      });
      return ticket;
    });
  }

  listMine(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  listAll(status?: string) {
    return this.prisma.ticket.findMany({
      where: status && status !== 'ALL' ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { username: true, email: true } },
      },
    });
  }

  async getForUser(userId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new AppException('NOT_FOUND', 'Ticket not found', HttpStatus.NOT_FOUND);
    return ticket;
  }

  async message(userId: string, ticketId: string, text: string, isStaff: boolean) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppException('NOT_FOUND', 'Ticket not found', HttpStatus.NOT_FOUND);
    if (!isStaff && ticket.userId !== userId) {
      throw new AppException('FORBIDDEN', 'Not your ticket', HttpStatus.FORBIDDEN);
    }
    if (ticket.status === 'CLOSED') {
      throw new AppException('TICKET_CLOSED', 'Ticket is closed', HttpStatus.CONFLICT);
    }
    const [msg] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId, authorId: userId, isStaff, text },
      }),
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: isStaff ? 'ANSWERED' : 'OPEN', updatedAt: new Date() },
      }),
    ]);
    return msg;
  }

  async close(userId: string, ticketId: string, isStaff: boolean) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppException('NOT_FOUND', 'Ticket not found', HttpStatus.NOT_FOUND);
    if (!isStaff && ticket.userId !== userId) {
      throw new AppException('FORBIDDEN', 'Not your ticket', HttpStatus.FORBIDDEN);
    }
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', updatedAt: new Date() },
    });
  }

  async setPriority(ticketId: string, priority: string) {
    return this.prisma.ticket.update({ where: { id: ticketId }, data: { priority } });
  }

  async setStatus(ticketId: string, status: string) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date() },
    });
  }
}
