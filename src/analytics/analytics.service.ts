import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { Customer } from 'src/customers/entities/customer.entity';
import { InvoiceStatus } from 'src/invoices/dto/create-invoice.dto';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { User } from 'src/users/entities/user.entity';
import { Between, Repository } from 'typeorm';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  // ─── LEGACY (kept for backwards compat) ─────────────────────────────────────
  async getDashboardStats() {
    const invoices = await this.invoiceRepo.find();

    const totalRevenue = invoices
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);

    return {
      totalInvoices: invoices.length,
      totalRevenue,
      paid: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
      pending: invoices.filter((i) => i.status === InvoiceStatus.PENDING)
        .length,
      refunded: invoices.filter((i) => i.status === InvoiceStatus.REFUNDED)
        .length,
    };
  }

  async getUserStats() {
    const totalUsers = await this.userRepo.count();
    const admins = await this.userRepo.count({ where: { role: 'admin' } });
    const users = await this.userRepo.count({ where: { role: 'user' } });
    return { totalUsers, admins, users };
  }

  // ─── NEW: ADMIN OVERVIEW ─────────────────────────────────────────────────────
  async getAdminOverview() {
    const invoices = await this.invoiceRepo.find({ relations: ['customer'] });
    const now = new Date();

    const paid = invoices.filter((i) => i.status === InvoiceStatus.PAID);
    const pending = invoices.filter((i) => i.status === InvoiceStatus.PENDING);
    const overdue = pending.filter(
      (i) => i.dueDate && new Date(i.dueDate) < now,
    );

    const totalRevenue = paid.reduce(
      (sum, i) => sum + Number(i.totalAmount),
      0,
    );
    const outstanding = pending.reduce(
      (sum, i) => sum + Number(i.totalAmount),
      0,
    );

    // Delta: compare this month vs last month revenue
    const startThisMonth = startOfMonth(now);
    const startLastMonth = startOfMonth(subMonths(now, 1));
    const endLastMonth = endOfMonth(subMonths(now, 1));

    const revenueThisMonth = paid
      .filter((i) => new Date(i.createdAt) >= startThisMonth)
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const revenueLastMonth = paid
      .filter(
        (i) =>
          new Date(i.createdAt) >= startLastMonth &&
          new Date(i.createdAt) <= endLastMonth,
      )
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);

    const revenueDeltaPct =
      revenueLastMonth === 0
        ? 100
        : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;

    // Top customers by paid invoice sum
    const customerMap = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    for (const inv of paid) {
      if (!inv.customer) continue;
      const key = inv.customer.publicId;
      const existing = customerMap.get(key) ?? {
        name: inv.customer.name,
        total: 0,
        count: 0,
      };
      existing.total += Number(inv.totalAmount);
      existing.count += 1;
      customerMap.set(key, existing);
    }
    const sorted = [...customerMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    const maxTotal = sorted[0]?.[1].total ?? 1;
    const topCustomers = sorted.map(([publicId, data]) => ({
      publicId,
      name: data.name,
      total: data.total,
      totalFmt: `₦${data.total.toLocaleString('en-NG')}`,
      invoiceCount: data.count,
      pct: Math.round((data.total / maxTotal) * 100),
    }));

    return {
      totalRevenue,
      collected: totalRevenue,
      outstanding,
      overdueCount: overdue.length,
      revenueDeltaPct: parseFloat(revenueDeltaPct.toFixed(1)),
      topCustomers,
    };
  }

  // ─── NEW: REVENUE CHART ──────────────────────────────────────────────────────
  async getRevenueChart(months = 6) {
    const now = new Date();
    const result: { month: string; revenue: number; refunds: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const target = subMonths(now, i);
      const start = startOfMonth(target);
      const end = endOfMonth(target);

      const [paidInvoices, refundedInvoices] = await Promise.all([
        this.invoiceRepo.find({
          where: { status: InvoiceStatus.PAID, createdAt: Between(start, end) },
        }),
        this.invoiceRepo.find({
          where: {
            status: InvoiceStatus.REFUNDED,
            createdAt: Between(start, end),
          },
        }),
      ]);

      const revenue = paidInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );
      const refunds = refundedInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );

      result.push({
        month: format(target, 'MMM'),
        revenue: parseFloat((revenue / 1000).toFixed(1)),
        refunds: parseFloat((refunds / 1000).toFixed(1)),
      });
    }

    return result;
  }

  // ─── NEW: WEEKLY CHART ───────────────────────────────────────────────────────
  async getWeeklyInvoiceChart() {
    const now = new Date();
    const result: { day: string; paid: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const start = startOfDay(day);
      const end = endOfDay(day);

      const count = await this.invoiceRepo.count({
        where: { status: InvoiceStatus.PAID, createdAt: Between(start, end) },
      });

      result.push({ day: format(day, 'EEE'), paid: count });
    }

    return result;
  }

  // ─── NEW: FULL ANALYTICS PAGE ────────────────────────────────────────────────
  async getFullAnalytics() {
    const [overview, revenueChart, weeklyChart, allInvoices] =
      await Promise.all([
        this.getAdminOverview(),
        this.getRevenueChart(12),
        this.getWeeklyInvoiceChart(),
        this.invoiceRepo.find(),
      ]);

    const now = new Date();
    const nonDraft = allInvoices.filter(
      (i) => i.status !== InvoiceStatus.DRAFT,
    );
    const paid = allInvoices.filter((i) => i.status === InvoiceStatus.PAID);
    const refunded = allInvoices.filter(
      (i) => i.status === InvoiceStatus.REFUNDED,
    );
    const pendingAll = allInvoices.filter(
      (i) => i.status === InvoiceStatus.PENDING,
    );
    const overdueAll = pendingAll.filter(
      (i) => i.dueDate && new Date(i.dueDate) < now,
    );

    const successRate =
      nonDraft.length === 0
        ? 0
        : parseFloat(((paid.length / nonDraft.length) * 100).toFixed(1));

    const totalAmount = allInvoices.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    const avgInvoice =
      allInvoices.length === 0
        ? 0
        : parseFloat((totalAmount / allInvoices.length).toFixed(2));

    const refundRate =
      allInvoices.length === 0
        ? 0
        : parseFloat(((refunded.length / allInvoices.length) * 100).toFixed(1));

    const overdueRate =
      allInvoices.length === 0
        ? 0
        : parseFloat(
            ((overdueAll.length / allInvoices.length) * 100).toFixed(1),
          );

    // Age buckets (pending invoices by days since creation)
    const ageBuckets = {
      '0-7': 0,
      '8-14': 0,
      '15-30': 0,
      '31-60': 0,
      '60+': 0,
    };
    for (const inv of pendingAll) {
      const ageDays = Math.floor(
        (now.getTime() - new Date(inv.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (ageDays <= 7) ageBuckets['0-7']++;
      else if (ageDays <= 14) ageBuckets['8-14']++;
      else if (ageDays <= 30) ageBuckets['15-30']++;
      else if (ageDays <= 60) ageBuckets['31-60']++;
      else ageBuckets['60+']++;
    }
    const ageData = Object.entries(ageBuckets).map(([range, count]) => ({
      range,
      count,
    }));

    // Success trend — monthly success rate for last 12 months
    const successTrend: { month: string; rate: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const target = subMonths(now, i);
      const start = startOfMonth(target);
      const end = endOfMonth(target);

      const monthInvoices = allInvoices.filter((inv) => {
        const d = new Date(inv.createdAt);
        return d >= start && d <= end && inv.status !== InvoiceStatus.DRAFT;
      });
      const monthPaid = monthInvoices.filter(
        (inv) => inv.status === InvoiceStatus.PAID,
      );
      const rate =
        monthInvoices.length === 0
          ? 0
          : parseFloat(
              ((monthPaid.length / monthInvoices.length) * 100).toFixed(1),
            );

      successTrend.push({ month: format(target, 'MMM'), rate });
    }

    return {
      overview,
      revenueChart,
      weeklyChart,
      successRate,
      avgInvoice,
      refundRate,
      overdueRate,
      ageData,
      successTrend,
    };
  }
}
