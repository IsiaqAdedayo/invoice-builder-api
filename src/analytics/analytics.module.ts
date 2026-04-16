import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, User])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, RolesGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
