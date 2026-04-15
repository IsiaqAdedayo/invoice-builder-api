// domain/invoice-calculator.ts

type Item = {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
};

export class InvoiceCalculator {
  static calculateItems(items: Item[]) {
    return items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;

      return {
        ...item,
        subtotal,
      };
    });
  }

  static calculateTotal(
    items: Item[],
    discount?: { type: 'percentage' | 'fixed'; value: number },
    tax?: { rate: number },
  ) {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal!, 0);

    let total = subtotal;

    // Apply discount
    if (discount) {
      if (discount.type === 'percentage') {
        total -= (discount.value / 100) * subtotal;
      } else {
        total -= discount.value;
      }
    }

    // ✅ Prevent negative totals
    total = Math.max(0, total);

    // Apply tax
    if (tax) {
      total += (tax.rate / 100) * total;
    }

    return total;
  }
}
