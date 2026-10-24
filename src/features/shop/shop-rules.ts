export interface SellableItem {
  id: number;
  name: string;
  sku: string;
  unit: string;
  quantity: string;
  sale_price: string;
  currency: string;
}

export interface CartLine {
  item: SellableItem;
  quantity: number;
}

/** Adds (or removes, with a negative step) pieces of an item. A line never goes above what is on the shelf or below one piece. */
export function changeQuantity(cart: CartLine[], item: SellableItem, step: number): CartLine[] {
  const available = Math.floor(Number(item.quantity));
  const existing = cart.find((line) => line.item.id === item.id);
  if (!existing) return step > 0 && available > 0 ? [...cart, { item, quantity: 1 }] : cart;
  const next = Math.min(existing.quantity + step, available);
  if (next < 1) return cart.filter((line) => line.item.id !== item.id);
  return cart.map((line) => (line.item.id === item.id ? { ...line, quantity: next } : line));
}

/** The total in the items' own currency, in whole cents so that 0.1 + 0.2 never shows as 0.30000000000000004. */
export function cartTotal(cart: CartLine[]): string {
  const cents = cart.reduce((sum, line) => sum + Math.round(Number(line.item.sale_price) * 100) * line.quantity, 0);
  return (cents / 100).toFixed(2);
}
