import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  meta: string;
  action?: ReactNode;
};

export function PanelTitle({ icon, title, meta, action }: Props) {
  return (
    <div className="panel-title">
      <h3>{icon}{title}</h3>
      <div className="panel-title-actions">
        <span>{meta}</span>
        {action}
      </div>
    </div>
  );
}
