import {
  Banknote,
  type LucideIcon,
  PackageCheck,
  PackageX,
  ShoppingBag,
  ShoppingCart,
  Tag
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  order_confirmed: ShoppingBag,
  cod_confirmation: Banknote,
  order_shipped: PackageCheck,
  order_cancelled: PackageX,
  cart_reminder: ShoppingCart
};

/** The icon for a Store message; extra status messages get a tag. */
export const storeMessageIcon = (kind: string): LucideIcon =>
  ICONS[kind] || Tag;
