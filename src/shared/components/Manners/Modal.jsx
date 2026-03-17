import React from "react";
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="manners-modal-overlay">
      <div className="manners-modal-content">
        <button className="manners-modal-close" onClick={onClose}>
          ✖
        </button>

        {title && <h3 className="manners-modal-title">{title}</h3>}
        <div className="manners-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
