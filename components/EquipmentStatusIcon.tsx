"use client";

type Props = {
  size?: number;
};

export default function EquipmentStatusIcon({ size = 16 }: Props) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src="/at960.png"
        alt="AT960"
        width={size}
        height={size}
        style={{
          width: size * 2.7,
          height: size * 2.7,
          objectFit: "contain",
          objectPosition: "center 53%",
          display: "block",
          transform: "translateY(3%)",
        }}
      />
    </span>
  );
}
