import type { ReactNode } from "react";

export function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="section-title">{icon}<h2>{title}</h2></div>;
}
