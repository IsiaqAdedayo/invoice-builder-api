/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
export const invoiceTemplate = (invoice: any) => {
  return `
    <html>
      <head>
        <style>
          body { font-family: Arial; padding: 40px; }
          .header { font-size: 24px; font-weight: bold; }
          .section { margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>

      <body>
        <div class="header">INVOICE #${invoice.id}</div>

        <div class="section">
          <p><b>Customer:</b> ${invoice.customer.name}</p>
          <p><b>Status:</b> ${invoice.status}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>
            ${invoice.items
              .map(
                (item: any) => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice}</td>
                <td>${item.subtotal}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>

        <h3>Total: ₦${invoice.totalAmount}</h3>
      </body>
    </html>
  `;
};
