/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    entity: string;
    entityId: number;
    action: string;
    before?: any;
    after?: any;
    performedBy?: number;
  }) {
    const log = this.auditRepo.create(data);
    return this.auditRepo.save(log);
  }

  async getRecent(limit = 10) {
    const logs = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      title: this.formatTitle(log),
      meta: this.formatTime(log.createdAt),
      amount: this.extractAmount(log),
      type: log.action,
    }));
  }

  private formatTitle(log: AuditLog) {
    switch (log.action) {
      case 'PAYMENT':
        return `Invoice ${log.after?.id} paid`;
      case 'REFUND':
        return `Invoice ${log.after?.id} refunded`;
      case 'CREATE':
        return `${log.entity} created`;
      case 'UPDATE':
        return `${log.entity} updated`;
      default:
        return `${log.entity} activity`;
    }
  }

  private extractAmount(log: AuditLog) {
    if (log.action === 'PAYMENT') {
      return `₦${log.after?.totalAmount?.toLocaleString?.() || ''}`;
    }
    return null;
  }

  private formatTime(date: Date) {
    const diff = Date.now() - new Date(date).getTime();

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;

    return `${Math.floor(hours / 24)} day ago`;
  }
}
