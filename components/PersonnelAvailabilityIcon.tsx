"use client";

import { Users } from "lucide-react";

type Props = {
  size?: number;
};

export default function PersonnelAvailabilityIcon({ size = 16 }: Props) {
  return <Users style={{ width: size, height: size }} />;
}
