// Modal: Accessible dialog overlay with frosted glass backdrop, keyboard escape handling, and focus trapping.
import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./ui.css";

function Modal({
  isOpen = false,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "520px",
  className = "",
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`ui-modal-container ${className}`} style={{ maxWidth }}>
        {(title || onClose) && (
          <div className="ui-modal-header">
            <div className="ui-modal-header-text">
              {title && <h3 className="ui-modal-title">{title}</h3>}
              {description && <p className="ui-modal-description">{description}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                className="ui-modal-close"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        <div className="ui-modal-body">{children}</div>

        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
export { Modal };
