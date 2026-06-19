"use client";

import { Package } from "lucide-react";

type Props = {
  size?: number;
};

export default function EquipmentStatusIcon({ size = 16 }: Props) {
  return <Package style={{ width: size, height: size }} />;
}
