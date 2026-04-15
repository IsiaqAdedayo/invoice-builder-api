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
}
