import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Legacy — kept for any existing callers */
  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboardStats();
  }

  /** GET /analytics/overview — admin dashboard stat cards */
  @Get('overview')
  getOverview() {
    return this.analyticsService.getAdminOverview();
  }

  /** GET /analytics/revenue-chart?months=6 — AreaChart data */
  @Get('revenue-chart')
  getRevenueChart(@Query('months') months?: string) {
    return this.analyticsService.getRevenueChart(months ? Number(months) : 6);
  }

  /** GET /analytics/weekly-chart — last 7 days BarChart data */
  @Get('weekly-chart')
  getWeeklyChart() {
    return this.analyticsService.getWeeklyInvoiceChart();
  }

  /** GET /analytics/full — full analytics page payload */
  @Get('full')
  getFullAnalytics() {
    return this.analyticsService.getFullAnalytics();
  }
}
