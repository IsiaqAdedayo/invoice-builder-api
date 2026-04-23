# Payvance Backend — Solution Guide

> A plain-language walkthrough of every change made to the NestJS API,
> written so you can follow the code and understand **why** each piece exists.

---

## Table of Contents

1. [The Core Idea](#1-the-core-idea)
2. [Route Map — Frontend → Endpoint](#2-route-map)
3. [New Decorator — `@CurrentUser()`](#3-new-decorator--currentuser)
4. [Invoice Entity — New Columns](#4-invoice-entity--new-columns)
5. [Analytics Service — Four New Methods](#5-analytics-service--four-new-methods)
6. [Analytics Controller — Four New Routes](#6-analytics-controller--four-new-routes)
7. [Analytics Module — Wiring Customer](#7-analytics-module--wiring-customer)
8. [Invoices Service — Search, Pagination, Recent](#8-invoices-service--search-pagination-recent)
9. [Invoices Controller — New Routes & Query Params](#9-invoices-controller--new-routes--query-params)
10. [Customers Service — Enrichment & Customer Invoices](#10-customers-service--enrichment--customer-invoices)
11. [Customers Controller — New Route](#11-customers-controller--new-route)
12. [Module Wiring Checklist](#12-module-wiring-checklist)
13. [Data Flow Diagram](#13-data-flow-diagram)
14. [Response Shape Quick Reference](#14-response-shape-quick-reference)

---

## 1. The Core Idea

Every piece of data displayed on screen follows this chain:

```
UI Component
  → React Query hook  (e.g. useAdminOverview)
    → API call        (e.g. GET /analytics/overview)
      → Controller    (AnalyticsController.getOverview)
        → Service     (AnalyticsService.getAdminOverview)
          → TypeORM   (SQL query to the database)
```

We worked backwards from the frontend pages to find what was missing and added
exactly what was needed — no more, no less.

---

## 2. Route Map

| Frontend page | Hook | Endpoint | Was it there? |
|---|---|---|---|
| `/admin` | `useAdminOverview()` | `GET /analytics/overview` | ❌ Added |
| `/admin` | `useRevenueChart()` | `GET /analytics/revenue-chart` | ❌ Added |
| `/admin` | `useWeeklyChart()` | `GET /analytics/weekly-chart` | ❌ Added |
| `/admin` | `useRecentInvoices()` | `GET /invoices/recent` | ❌ Added |
| `/admin/invoices` | `useInvoices(params)` | `GET /invoices` | ⚠️ Existed, no search/pagination |
| `/admin/invoices` | `useCreateInvoice()` | `POST /invoices` | ✅ Existed |
| `/admin/invoices` | `useUpdateInvoiceStatus()` | `PATCH /invoices/:id/status` | ✅ Existed |
| `/admin/invoices` | `useRefundInvoice()` | `POST /invoices/:id/refund` | ✅ Existed |
| `/admin/customers` | `useCustomers()` | `GET /customers` | ⚠️ Existed, no enrichment |
| `/admin/customers` | `useCreateCustomer()` | `POST /customers` | ✅ Existed |
| `/admin/analytics` | `useFullAnalytics()` | `GET /analytics/full` | ❌ Added |
| `/customer` | `useMyInvoices(id)` | `GET /customers/:id/invoices` | ❌ Added |
| `/customer/invoices` | `usePayInvoice()` | `POST /invoices/:id/pay` | ✅ Existed |
| Both | PDF button | `GET /invoices/:id/pdf` | ✅ Existed |

---

## 3. New Decorator — `@CurrentUser()`

**File:** `src/auth/decorators/current-user.decorator.ts`

```typescript
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

**Why it exists:**
After `JwtAuthGuard` validates the Bearer token, NestJS attaches the decoded
JWT payload to `req.user`. Without this decorator, you'd have to write
`@Req() req: Request` in every controller and then do `req.user` manually.
With it, you simply write:

```typescript
@Get('me')
getMe(@CurrentUser() user: JwtUser) { ... }
```

**When to use it next:**
In `CustomersController.findCustomerInvoices`, add a check to confirm
`user.customerId === id` before returning the data — this prevents one
customer from reading another's invoices.

---

## 4. Invoice Entity — New Columns

**File:** `src/invoices/entities/invoice.entity.ts`

```typescript
@UpdateDateColumn()
updatedAt: Date;

@Column({ nullable: true, type: 'timestamp' })
dueDate: Date;
```

**`updatedAt`** — TypeORM's `@UpdateDateColumn` automatically sets this to
the current timestamp every time the row is saved. Useful for audit trails
and sorting.

**`dueDate`** — Nullable so existing invoices are not broken. The analytics
service uses this to detect **overdue** invoices:

```typescript
const isOverdue = invoice.status === 'pending' && invoice.dueDate < now;
```

> [!IMPORTANT]
> These are new database columns. If you are in development with
> `synchronize: true` in your TypeORM config, they are created automatically
> on next app start. In production, write a migration.

---

## 5. Analytics Service — Four New Methods

**File:** `src/analytics/analytics.service.ts`

The original service only had `getDashboardStats()` (basic counts) and
`getUserStats()`. Four new methods were added.

---

### 5.1 `getAdminOverview()`

**Used by:** `GET /analytics/overview` → `useAdminOverview()` hook on `/admin`

**What it returns:**

```
totalRevenue    — sum of all PAID invoice amounts
collected       — same as totalRevenue (can diverge with partial payments later)
outstanding     — sum of all PENDING invoice amounts
overdueCount    — count of PENDING invoices where dueDate < today
revenueDeltaPct — percentage change vs last month (for the "↑ 12.4%" badge)
topCustomers    — top 5 customers by paid revenue, with normalised % for the progress bar
```

**How `revenueDeltaPct` is calculated:**

```typescript
const revenueThisMonth = /* sum of paid invoices created this calendar month */;
const revenueLastMonth = /* sum of paid invoices created last calendar month */;

const delta = ((thisMonth - lastMonth) / lastMonth) * 100;
// If lastMonth is 0, delta = 100 (anything is infinite growth from zero)
```

**How the progress bar % works:**
The top customer gets 100%, every other customer is expressed as a percentage
of the top customer's total. This means the frontend progress bar always has
a clear "max" to draw against.

```typescript
const maxTotal = sorted[0].total;
pct: Math.round((customer.total / maxTotal) * 100)
// Customer A: 1,200,000 → 100%
// Customer B:   860,000 → 72%
// Customer C:   400,000 → 33%
```

---

### 5.2 `getRevenueChart(months = 6)`

**Used by:** `GET /analytics/revenue-chart?months=6` → `useRevenueChart()` on `/admin`

**What it returns:**

```json
[
  { "month": "Nov", "revenue": 320, "refunds": 0 },
  { "month": "Dec", "revenue": 850, "refunds": 40 },
  { "month": "Jan", "revenue": 1200, "refunds": 0 }
]
```

Revenue is in **₦ thousands** (divided by 1000) because the frontend chart
axis formatter already appends `k`.

**How it works:**
Loops backwards through N months using `date-fns subMonths()`. For each month
it runs two queries with TypeORM's `Between(startOfMonth, endOfMonth)` operator
to count PAID and REFUNDED invoice amounts.

```typescript
for (let i = months - 1; i >= 0; i--) {
  const target = subMonths(now, i);
  const start  = startOfMonth(target);
  const end    = endOfMonth(target);
  // query Between(start, end) → sum → divide by 1000
}
```

---

### 5.3 `getWeeklyInvoiceChart()`

**Used by:** `GET /analytics/weekly-chart` → `useWeeklyChart()` on `/admin`

**What it returns:**

```json
[
  { "day": "Tue", "paid": 2 },
  { "day": "Wed", "paid": 0 },
  { "day": "Thu", "paid": 5 }
]
```

Same pattern as the revenue chart but iterates 7 days back with `subDays()`,
and only counts PAID invoices per day (not sums amounts).

---

### 5.4 `getFullAnalytics()`

**Used by:** `GET /analytics/full` → `useFullAnalytics()` on `/admin/analytics`

Combines everything into one response so the analytics page makes **one HTTP
request** instead of five.

**How it works:**

```typescript
// All four fetches run in parallel — no sequential waterfall
const [overview, revenueChart, weeklyChart, allInvoices] = await Promise.all([
  this.getAdminOverview(),
  this.getRevenueChart(12),
  this.getWeeklyInvoiceChart(),
  this.invoiceRepo.find(),
]);
```

Then computes from `allInvoices`:

| Field | Formula |
|---|---|
| `successRate` | `(paid / nonDraft) * 100` |
| `avgInvoice` | `totalAmount / invoiceCount` |
| `refundRate` | `(refunded / all) * 100` |
| `overdueRate` | `(pending-past-due / all) * 100` |
| `ageData` | Buckets pending invoices into 0-7, 8-14, 15-30, 31-60, 60+ days |
| `successTrend` | Monthly success rate for last 12 months (for the line chart) |

**Age buckets** tell you how long invoices have been sitting unpaid:

```typescript
if      (ageDays <= 7)  ageBuckets['0-7']++;
else if (ageDays <= 14) ageBuckets['8-14']++;
else if (ageDays <= 30) ageBuckets['15-30']++;
else if (ageDays <= 60) ageBuckets['31-60']++;
else                    ageBuckets['60+']++;
```

---

## 6. Analytics Controller — Four New Routes

**File:** `src/analytics/analytics.controller.ts`

`@Roles('admin')` is applied at the class level — every route in this
controller is admin-only.

```
GET /analytics/overview        → getAdminOverview()
GET /analytics/revenue-chart   → getRevenueChart(months?)
GET /analytics/weekly-chart    → getWeeklyInvoiceChart()
GET /analytics/full            → getFullAnalytics()
GET /analytics/dashboard       → getDashboardStats()  (legacy — kept)
```

`revenue-chart` accepts an optional query param:

```
GET /analytics/revenue-chart?months=12
```

If `months` is not provided, defaults to 6.

---

## 7. Analytics Module — Wiring Customer

**File:** `src/analytics/analytics.module.ts`

```typescript
// Before
TypeOrmModule.forFeature([Invoice, User])

// After  ← added Customer
TypeOrmModule.forFeature([Invoice, User, Customer])
```

**Why this matters:**
NestJS dependency injection works by module. If `Customer` is not in
`forFeature`, the `@InjectRepository(Customer)` in `AnalyticsService` will
fail at startup with:

```
Nest can't resolve dependencies of the AnalyticsService.
No repository for entity Customer found.
```

---

## 8. Invoices Service — Search, Pagination, Recent

**File:** `src/invoices/invoices.service.ts`

### 8.1 `findAll(query)` — Updated

**Before:** `findAll()` took no arguments and returned every invoice in the DB.

**After:** Accepts a `InvoiceQuery` object and returns a paginated response.

**Query params:**

```typescript
interface InvoiceQuery {
  status?: InvoiceStatus;    // 'draft' | 'pending' | 'paid' | 'refunded'
  search?: string;           // searches customer name OR invoice publicId
  page?: number | string;    // default 1
  limit?: number | string;   // default 10, capped at 50
  sortBy?: string;           // 'createdAt' | 'totalAmount' | 'status' | 'dueDate'
  order?: 'ASC' | 'DESC';   // default DESC
}
```

**Why QueryBuilder instead of `find()`?**
The `search` param needs to check two columns across a join
(`customer.name` and `invoice.publicId`). TypeORM's `find()` can't express
`OR` conditions across joined tables easily. `createQueryBuilder` can:

```typescript
qb.andWhere(
  '(customer.name ILIKE :search OR invoice.publicId ILIKE :search)',
  { search: `%${query.search}%` },
);
```

**Paginated response shape:**

```json
{
  "data": [ ...formatted invoices... ],
  "meta": {
    "total": 120,
    "page": 2,
    "limit": 10,
    "lastPage": 12
  }
}
```

The frontend table uses `meta.total` to know how many page buttons to render,
and `meta.lastPage` to know when to disable the "Next" button.

---

### 8.2 `findRecent(limit = 5)` — New

Simple query, orders by `createdAt DESC`, takes N rows.
Used by the dashboard overview table (`useRecentInvoices`).

---

### 8.3 Private `formatInvoice()` helper

Both `findAll` and `findRecent` return the same shaped object. The helper
centralises this so there is only one place to change the response shape:

```typescript
private formatInvoice(invoice: Invoice) {
  const suffix = invoice.publicId.slice(-6).toUpperCase();
  return {
    publicId:      invoice.publicId,       // raw ID for API calls
    id:            `INV-${suffix}`,        // human label e.g. "INV-AB12CD"
    customerName:  invoice.customer?.name,
    amountFmt:     `₦${Number(invoice.totalAmount).toLocaleString('en-NG')}`,
    status:        invoice.status,
    issuedFmt:     format(invoice.createdAt, 'dd MMM yyyy'),
    dueFmt:        invoice.dueDate ? format(invoice.dueDate, ...) : '—',
    ...
  };
}
```

---

## 9. Invoices Controller — New Routes & Query Params

**File:** `src/invoices/invoices.controller.ts`

### `GET /invoices/recent`

```typescript
@Get('recent')
findRecent(@Query('limit') limit?: string) {
  return this.invoicesService.findRecent(limit ? Number(limit) : 5);
}
```

> [!IMPORTANT]
> The `/recent` route is declared **before** `/:id` in the controller.
> This matters because NestJS matches routes top-to-bottom. If `:id` came
> first, the string `"recent"` would be treated as the invoice ID parameter
> and cause a "not found" error.

### `GET /invoices` (updated)

```
GET /invoices?status=paid&search=acme&page=2&limit=10&sortBy=totalAmount&order=ASC
```

The `@Query() query: InvoiceQuery` binding forwards all query params to the
service automatically.

---

## 10. Customers Service — Enrichment & Customer Invoices

**File:** `src/customers/customers.service.ts`

### 10.1 `findAll()` — Enriched

The admin customers table shows columns that are not stored directly on the
`Customer` row — they must be derived from the customer's invoices.

**Added fields:**

| Field | How it's computed |
|---|---|
| `totalSpent` | Sum of `totalAmount` for all PAID invoices |
| `totalSpentFmt` | `₦1,200,000` — pre-formatted string |
| `invoiceCount` | Total invoices across all statuses |
| `paidRate` | `(paid count / total count) * 100` — percentage for the Progress bar |
| `status` | Derived (see rules below) |
| `joinedFmt` | `createdAt` formatted as `'22 Apr 2025'` |

**Status derivation:**

```
"overdue"  → has any PENDING invoice where dueDate < today
"inactive" → has at least 1 invoice, but none created in the last 90 days
"active"   → everything else (including brand new customers with 0 invoices)
```

```typescript
const hasOverdue  = pending.some(i => i.dueDate && new Date(i.dueDate) < now);
const hasRecent   = invoices.some(i => new Date(i.createdAt) >= cutoff90);

if (hasOverdue)                   status = 'overdue';
else if (count > 0 && !hasRecent) status = 'inactive';
else                              status = 'active';
```

---

### 10.2 `findCustomerInvoices(customerId)` — New

Queries invoices where `customer.publicId = :customerId`, returns the same
formatted shape as `findAll`, scoped to one customer.

Used by both customer-facing pages:
- `/customer` (dashboard overview)
- `/customer/invoices` (full list)

> [!WARNING]
> Currently any authenticated user can read any customer's invoices by
> knowing their `publicId`. In production, add this check in the controller:
>
> ```typescript
> if (user.customerId !== customerId) throw new ForbiddenException();
> ```

---

## 11. Customers Controller — New Route

**File:** `src/customers/customers.controller.ts`

```typescript
@Get(':id/invoices')
findCustomerInvoices(@Param('id') customerId: string) {
  return this.customersService.findCustomerInvoices(customerId);
}
```

Maps to: `GET /customers/cust_abc123/invoices`

Note that `:id` here is the customer's `publicId` (e.g. `cust_abc123`),
not the numeric primary key.

---

## 12. Module Wiring Checklist

These are all the module-level changes. If any is missing, NestJS throws
a dependency injection error at startup.

### AnalyticsModule
```typescript
// analytics.module.ts
TypeOrmModule.forFeature([Invoice, User, Customer])  // ← Customer added
```

### CustomersModule
```typescript
// customers.module.ts
TypeOrmModule.forFeature([Customer, Invoice])  // ← Invoice added
```

### Customer entity (already correct — no change needed)
```typescript
@OneToMany(() => Invoice, (invoice) => invoice.customer)
invoices: Invoice[];
```

### Invoice entity (new columns added)
```typescript
@UpdateDateColumn()
updatedAt: Date;

@Column({ nullable: true, type: 'timestamp' })
dueDate: Date;
```

---

## 13. Data Flow Diagram

```
Frontend Page           Hook                     Endpoint
──────────────────────────────────────────────────────────────────
/admin                  useAdminOverview()   →   GET /analytics/overview
                        useRevenueChart()    →   GET /analytics/revenue-chart?months=6
                        useWeeklyChart()     →   GET /analytics/weekly-chart
                        useRecentInvoices()  →   GET /invoices/recent?limit=5

/admin/invoices         useInvoices(params)  →   GET /invoices?status=&search=&page=&limit=
                        useCreateInvoice()   →   POST /invoices
                        useUpdateStatus()    →   PATCH /invoices/:id/status
                        useRefundInvoice()   →   POST /invoices/:id/refund
                        PDF button           →   GET /invoices/:id/pdf (browser download)

/admin/customers        useCustomers()       →   GET /customers
                        useCreateCustomer()  →   POST /customers

/admin/analytics        useFullAnalytics()   →   GET /analytics/full

/customer               useMyInvoices(id)    →   GET /customers/:id/invoices
/customer/invoices      useMyInvoices(id)    →   GET /customers/:id/invoices
                        usePayInvoice()      →   POST /invoices/:id/pay
```

---

## 14. Response Shape Quick Reference

### `GET /analytics/overview`
```json
{
  "totalRevenue": 5200000,
  "collected": 5200000,
  "outstanding": 800000,
  "overdueCount": 3,
  "revenueDeltaPct": 12.4,
  "topCustomers": [
    {
      "publicId": "cust_xxx",
      "name": "Acme Ltd",
      "total": 1200000,
      "totalFmt": "₦1,200,000",
      "invoiceCount": 4,
      "pct": 100
    }
  ]
}
```

### `GET /analytics/revenue-chart`
```json
[
  { "month": "Nov", "revenue": 320.5, "refunds": 0 },
  { "month": "Dec", "revenue": 850.0, "refunds": 40.0 },
  { "month": "Jan", "revenue": 1200.0, "refunds": 0 }
]
```

### `GET /invoices` (paginated)
```json
{
  "data": [
    {
      "publicId": "inv_abc123def456",
      "id": "INV-F456",
      "customerName": "Acme Ltd",
      "customerEmail": "info@acme.com",
      "totalAmount": 185000,
      "amountFmt": "₦185,000",
      "status": "paid",
      "issuedFmt": "22 Apr 2025",
      "dueFmt": "30 Apr 2025",
      "dueDate": "2025-04-30T00:00:00.000Z",
      "createdAt": "2025-04-22T10:00:00.000Z"
    }
  ],
  "meta": { "total": 120, "page": 1, "limit": 10, "lastPage": 12 }
}
```

### `GET /customers` (enriched)
```json
[
  {
    "publicId": "cust_xyz",
    "name": "Acme Ltd",
    "email": "info@acme.com",
    "totalSpent": 1200000,
    "totalSpentFmt": "₦1,200,000",
    "invoiceCount": 8,
    "paidRate": 87.5,
    "status": "active",
    "joinedFmt": "01 Jan 2025"
  }
]
```

### `GET /customers/:id/invoices`
Same shape as the items inside `GET /invoices → data[]`, but scoped to one customer.

### `GET /analytics/full`
```json
{
  "overview": { ...same as /analytics/overview... },
  "revenueChart": [ ...same as /analytics/revenue-chart... ],
  "weeklyChart": [ ...same as /analytics/weekly-chart... ],
  "successRate": 78.5,
  "avgInvoice": 145000.00,
  "refundRate": 3.2,
  "overdueRate": 12.1,
  "ageData": [
    { "range": "0-7",  "count": 4 },
    { "range": "8-14", "count": 2 },
    { "range": "15-30","count": 7 },
    { "range": "31-60","count": 3 },
    { "range": "60+",  "count": 1 }
  ],
  "successTrend": [
    { "month": "May", "rate": 65.0 },
    { "month": "Jun", "rate": 72.5 }
  ]
}
```
