import React, { memo, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const SCROLLABLE_OVERFLOW_VALUES = new Set(["auto", "scroll", "overlay"]);

const isHTMLElement = (value) => value instanceof HTMLElement;

const isScrollableElement = (element) => {
  if (!isHTMLElement(element)) {
    return false;
  }

  const { overflowY } = window.getComputedStyle(element);

  return (
    SCROLLABLE_OVERFLOW_VALUES.has(overflowY) &&
    element.scrollHeight - element.clientHeight > 1
  );
};

const canScrollInDirection = (element, deltaY) => {
  if (!isScrollableElement(element) || deltaY === 0) {
    return false;
  }

  const maxScrollTop = element.scrollHeight - element.clientHeight;

  if (deltaY > 0) {
    return element.scrollTop < maxScrollTop - 1;
  }

  return element.scrollTop > 1;
};

const resolveScrollTarget = (startElement, bodyElement, deltaY) => {
  if (!isHTMLElement(bodyElement)) {
    return null;
  }

  let current = startElement instanceof Element ? startElement : null;

  while (current && current !== bodyElement) {
    if (canScrollInDirection(current, deltaY)) {
      return current;
    }
    current = current.parentElement;
  }

  return canScrollInDirection(bodyElement, deltaY) ? bodyElement : null;
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  },
};

const modalVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.985,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

const MotionDiv = motion.div;

const Modal = memo(
  ({
    title,
    onClose,
    children,
    size = "md",
    footer = null,
    isOpen = true,
    className = "",
    icon = null,
    closeOnOverlayClick = true,
  }) => {
    const reduceMotion = useReducedMotion();
    const overlayPressStartedRef = useRef(false);
    const shellRef = useRef(null);
    const bodyRef = useRef(null);
    const touchStateRef = useRef({
      lastY: null,
      startTarget: null,
    });

    const sizeClasses = {
      sm: "modal-pequeno",
      md: "modal-mediano",
      lg: "modal-grande",
      xl: "modal-extra",
    };

    useEffect(() => {
      const prevOverflow = document.body.style.overflow;

      if (isOpen) {
        document.body.classList.add("modal-open");
        document.body.style.overflow = "hidden";
      } else {
        document.body.classList.remove("modal-open");
        document.body.style.overflow = prevOverflow || "";
      }

      return () => {
        document.body.classList.remove("modal-open");
        document.body.style.overflow = prevOverflow || "";
      };
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen || typeof window === "undefined") {
        return undefined;
      }

      const shellElement = shellRef.current;
      const bodyElement = bodyRef.current;

      if (!shellElement || !bodyElement) {
        return undefined;
      }

      const handleWheel = (event) => {
        if (event.defaultPrevented) {
          return;
        }

        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
          return;
        }

        const scrollTarget = resolveScrollTarget(
          event.target,
          bodyElement,
          event.deltaY,
        );

        if (!scrollTarget) {
          return;
        }

        event.preventDefault();
        scrollTarget.scrollTop += event.deltaY;
      };

      const handleTouchStart = (event) => {
        if (event.touches.length !== 1) {
          return;
        }

        touchStateRef.current = {
          lastY: event.touches[0].clientY,
          startTarget: event.target,
        };
      };

      const handleTouchMove = (event) => {
        if (event.defaultPrevented || event.touches.length !== 1) {
          return;
        }

        const currentY = event.touches[0].clientY;
        const lastY = touchStateRef.current.lastY;

        if (lastY === null) {
          touchStateRef.current.lastY = currentY;
          return;
        }

        const deltaY = lastY - currentY;
        touchStateRef.current.lastY = currentY;

        if (Math.abs(deltaY) < 1) {
          return;
        }

        const scrollTarget = resolveScrollTarget(
          touchStateRef.current.startTarget ?? event.target,
          bodyElement,
          deltaY,
        );

        if (!scrollTarget) {
          return;
        }

        event.preventDefault();
        scrollTarget.scrollTop += deltaY;
      };

      const resetTouchState = () => {
        touchStateRef.current = {
          lastY: null,
          startTarget: null,
        };
      };

      shellElement.addEventListener("wheel", handleWheel, { passive: false });
      shellElement.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      shellElement.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      shellElement.addEventListener("touchend", resetTouchState);
      shellElement.addEventListener("touchcancel", resetTouchState);

      return () => {
        shellElement.removeEventListener("wheel", handleWheel);
        shellElement.removeEventListener("touchstart", handleTouchStart);
        shellElement.removeEventListener("touchmove", handleTouchMove);
        shellElement.removeEventListener("touchend", resetTouchState);
        shellElement.removeEventListener("touchcancel", resetTouchState);
      };
    }, [isOpen]);

    const handleOverlayMouseDown = (event) => {
      overlayPressStartedRef.current = event.target === event.currentTarget;
    };

    const handleOverlayClick = (event) => {
      const shouldClose =
        closeOnOverlayClick &&
        overlayPressStartedRef.current &&
        event.target === event.currentTarget;

      overlayPressStartedRef.current = false;

      if (shouldClose) {
        onClose();
      }
    };

    return (
      <AnimatePresence mode="wait">
        {isOpen && (
          <MotionDiv
            className="modal-overlay capa-modal modal-core-overlay"
            variants={overlayVariants}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            exit="exit"
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
          >
            <MotionDiv
              className={`modal-core-shell ${sizeClasses[size]} ${className}`}
              ref={shellRef}
              variants={modalVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                aria-label="Cerrar modal"
                className="modal-core-close"
                onClick={onClose}
              >
                &times;
              </button>

              <div className="modal-core-header">
                {icon ? (
                  <div className="modal-core-header-icon">
                    {icon}
                  </div>
                ) : null}
                <h1 className="modal-core-title">{title}</h1>
              </div>

              <div className="cuerpo-modal" ref={bodyRef}>{children}</div>

              {footer ? (
                <div className="pie-modal">
                  <div className="contenedor-botones">{footer}</div>
                </div>
              ) : null}
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    );
  },
);

Modal.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  footer: PropTypes.node,
  isOpen: PropTypes.bool,
  className: PropTypes.string,
  icon: PropTypes.node,
  closeOnOverlayClick: PropTypes.bool,
};

export default Modal;
