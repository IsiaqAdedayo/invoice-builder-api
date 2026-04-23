# API Reference Documentation

This document provides a complete breakdown of all available REST endpoints in the Payvance Backend API, including their expected request parameters (query/body) and their JSON response shapes.

## Table of Contents
1. [Analytics API](#1-analytics-api)
2. [Invoices API](#2-invoices-api)
3. [Customers API](#3-customers-api)
4. [Auth API](#4-auth-api)
5. [Users API](#5-users-api)

---

## 1. Analytics API
All endpoints here are protected by `JwtAuthGuard` and restricted to `@Roles('admin')`.

### `GET /analytics/overview`
Fetches high-level metrics for the admin dashboard stat cards.

**Response:**
```json
{
  "totalRevenue": 5200000,
  "collected": 5200000,
  "outstanding": 800000,
  "overdueCount": 3,
  "revenueDeltaPct": 12.4,
  "topCustomers": [
    {
      "publicId": "cust_abc123",
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
Fetches monthly revenue and refund totals for the AreaChart.

**Query Parameters:**
- `months` (optional): Number of months to look back. Default is 6.

**Response:**
```json
[
  { "month": "Nov", "revenue": 320.5, "refunds": 0 },
  { "month": "Dec", "revenue": 850.0, "refunds": 40.0 },
  { "month": "Jan", "revenue": 1200.0, "refunds": 0 }
]
```
*(Note: Revenue and refunds are expressed in thousands (₦k) so 320.5 means ₦320,500)*

### `GET /analytics/weekly-chart`
Fetches daily counts of paid invoices for the last 7 days.

**Response:**
```json
[
  { "day": "Mon", "paid": 4 },
  { "day": "Tue", "paid": 7 },
  { "day": "Wed", "paid": 2 }
]
```

### `GET /analytics/full`
Fetches a comprehensive payload combining overview, charts, and computed rates.

**Response:**
```json
{
  "overview": { /* ...same as /analytics/overview... */ },
  "revenueChart": [ /* ...same as /analytics/revenue-chart... */ ],
  "weeklyChart": [ /* ...same as /analytics/weekly-chart... */ ],
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

---

## 2. Invoices API
Protected by `JwtAuthGuard`. Some endpoints are restricted to admins.

### `GET /invoices`
Retrieves a paginated, filterable list of invoices.

**Query Parameters:**
- `status` (optional): `draft` | `pending` | `paid` | `refunded`
- `search` (optional): Partial match on customer name or invoice ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `sortBy` (optional): `createdAt` | `totalAmount` | `status` | `dueDate` (default: `createdAt`)
- `order` (optional): `ASC` | `DESC` (default: `DESC`)

**Response:**
```json
{
  "data": [
    {
      "publicId": "inv_abc123def",
      "id": "INV-123DEF",
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
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 10,
    "lastPage": 12
  }
}
```

### `GET /invoices/recent` (Admin only)
Retrieves the most recently created invoices for the dashboard widget.

**Query Parameters:**
- `limit` (optional): Number of records to return. Default is 5.

**Response:** Returns an array of invoice objects identical to the `data` array in `GET /invoices`.

### `POST /invoices`
Creates a new invoice.

**Request Body** (`CreateInvoiceDto`):
```json
{
  "customerId": "cust_xyz789",
  "status": "pending",
  "items": [
    {
      "description": "Web Development Services",
      "quantity": 1,
      "unitPrice": 150000
    }
  ],
  "discount": {
    "type": "percentage",
    "value": 10
  },
  "tax": {
    "rate": 7.5
  }
}
```
*(Note: `discount` and `tax` are optional. `status` cannot be `paid` on creation.)*

**Response:** Returns the fully populated invoice record from the database.

### `PATCH /invoices/:id/status`
Updates the status of an existing invoice (e.g., from `draft` to `pending`).

**Path Parameter:**
- `id`: The `publicId` of the invoice.

**Request Body:**
```json
{
  "status": "pending"
}
```

**Response:** Returns the updated invoice entity.

### `POST /invoices/:id/pay`
Simulates paying an invoice. Will transition the status to `paid` and create a Payment record.

**Path Parameter:**
- `id`: The `publicId` of the invoice.

**Request Body:**
```json
{
  "amount": 150000
}
```
*(Note: amount must strictly match the invoice's `totalAmount`)*

**Response:**
```json
{
  "message": "Payment successful",
  "invoice": { /* Updated invoice entity */ },
  "payment": { /* New payment record */ }
}
```

### `POST /invoices/:id/refund`
Processes a refund for a previously paid invoice.

**Path Parameter:**
- `id`: The `publicId` of the invoice.

**Request Body:** None.

**Response:**
```json
{
  "message": "Refund successful",
  "invoice": { /* Updated invoice entity (status: 'refunded') */ },
  "refund": { /* New payment record of type 'refund' */ }
}
```

### `GET /invoices/:id/pdf`
Generates and downloads a PDF copy of the invoice.

**Response:** Binary stream (`application/pdf`) sent as an attachment.

---

## 3. Customers API
Protected by `JwtAuthGuard`.

### `GET /customers`
Fetches a list of all customers, enriched with computed lifetime metrics.

**Response:**
```json
[
  {
    "publicId": "cust_xyz789",
    "name": "Acme Ltd",
    "email": "info@acme.com",
    "phone": "+23480000000",
    "address": "123 Business Rd, Lagos",
    "totalSpent": 1200000,
    "totalSpentFmt": "₦1,200,000",
    "invoiceCount": 8,
    "paidRate": 87.5,
    "status": "active",
    "joinedFmt": "01 Jan 2025",
    "createdAt": "2025-01-01T08:00:00.000Z"
  }
]
```

### `POST /customers`
Creates a new customer.

**Request Body** (`CreateCustomerDto`):
```json
{
  "name": "Acme Ltd",
  "email": "info@acme.com",
  "phone": "+23480000000",
  "address": "123 Business Rd, Lagos"
}
```

**Response:** Returns the newly created Customer entity.

### `GET /customers/:id`
Fetches details for a specific customer.

**Path Parameter:**
- `id`: The `publicId` of the customer.

**Response:** Returns the raw Customer entity.

### `GET /customers/:id/invoices`
Retrieves all invoices belonging to a specific customer. Formatted identical to the `GET /invoices` list elements.

**Path Parameter:**
- `id`: The `publicId` of the customer.

**Response:**
```json
[
  {
    "publicId": "inv_abc123def",
    "id": "INV-123DEF",
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
]
```

---

## 4. Auth API
### `POST /auth/signup`
Registers a new user account.

**Request Body** (`SignupDto`):
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "role": "user"
}
```
*(Note: role defaults to "user" if not provided)*

**Response:** Returns the created User entity (excluding password if serialized properly).
```json
{
  "id": 1,
  "publicId": "usr_abc123",
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2025-04-23T10:00:00.000Z",
  "updatedAt": "2025-04-23T10:00:00.000Z"
}
```

### `POST /auth/login`
Authenticates a user and returns a JWT token.

**Request Body** (`LoginDto`):
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## 5. Users API
All endpoints here are protected by `JwtAuthGuard` and restricted to `@Roles('admin')`.

### `GET /users`
Retrieves a paginated and filterable list of users.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `role` (optional): Filter by role: `admin` | `user`
- `search` (optional): Partial match (`ILIKE`) on email

**Response:**
```json
{
  "data": [
    {
      "publicId": "usr_abc123",
      "email": "user@example.com",
      "role": "user",
      "createdAt": "2025-04-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "lastPage": 5
  }
}
```
