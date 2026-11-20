// Card: Foundation surface container with 12px border-radius, clean border, and optional header/footer slots.
import React from "react";
import "./ui.css";

function Card({
  children,
  className = "",
  title,
  description,
  action,
  footer,
  noPadding = false,
  ...props
}) {
  const hasHeader = title || description || action;

  return (
    <div className={`ui-card ${className}`} {...props}>
      {hasHeader && (
        <div className="ui-card-header">
          <div className="ui-card-header-text">
            {title && <h3 className="ui-card-title">{title}</h3>}
            {description && <p className="ui-card-description">{description}</p>}
          </div>
          {action && <div className="ui-card-header-action">{action}</div>}
        </div>
      )}

      <div className={`ui-card-body ${noPadding ? "ui-card-body--no-pad" : ""}`}>
        {children}
      </div>

      {footer && <div className="ui-card-footer">{footer}</div>}
    </div>
  );
}

export default Card;
export { Card };
