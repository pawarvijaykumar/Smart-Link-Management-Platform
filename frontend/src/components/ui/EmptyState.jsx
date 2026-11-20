// EmptyState: Helpful placeholder replacing empty data with an informative message and primary action trigger.
import React from "react";
import Button from "./Button";
import "./ui.css";

function EmptyState({
  icon: Icon,
  title = "No data yet",
  description = "New activity will appear here once visitors interact with your links.",
  action,
  actionLabel,
  onAction,
  actionIcon,
  className = "",
}) {
  return (
    <div className={`ui-empty-state ${className}`}>
      {Icon && (
        <div className="ui-empty-icon-wrap" aria-hidden="true">
          <Icon size={24} strokeWidth={1.5} className="ui-empty-icon" />
        </div>
      )}

      {title && <h4 className="ui-empty-title">{title}</h4>}
      {description && <p className="ui-empty-description">{description}</p>}

      {action ? (
        <div className="ui-empty-action">{action}</div>
      ) : actionLabel && onAction ? (
        <div className="ui-empty-action">
          <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
export { EmptyState };
