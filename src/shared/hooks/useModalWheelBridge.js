import { useEffect } from "react";

const MODAL_ROOT_SELECTOR = [
  ".modal-core-shell",
  ".contenedor-modal",
  ".confirm-modal-shell",
  ".delete-modal__container",
  ".manners-modal-content",
  ".producto-modal",
  ".admin-home-modal",
  ".modal-pedidos__product-modal",
].join(", ");

const SCROLL_CONTAINER_SELECTOR = [
  ".cuerpo-modal",
  ".confirm-modal-body.has-scroll",
  ".delete-modal__body",
  ".manners-modal-body",
  ".producto-modal__content",
  ".admin-home-modal-body",
  ".modal-pedidos__product-content",
].join(", ");

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

const findPrimaryScrollContainer = (modalRoot) => {
  if (!isHTMLElement(modalRoot)) {
    return null;
  }

  const scrollContainer = modalRoot.querySelector(SCROLL_CONTAINER_SELECTOR);
  return isScrollableElement(scrollContainer) ? scrollContainer : null;
};

const findScrollableAncestor = (startElement, stopElement) => {
  let current = isHTMLElement(startElement) ? startElement : null;

  while (current && current !== stopElement) {
    if (isScrollableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

export const useModalWheelBridge = () => {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const handleWheel = (event) => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const modalRoot = target.closest(MODAL_ROOT_SELECTOR);
      if (!isHTMLElement(modalRoot)) {
        return;
      }

      const scrollContainer = findPrimaryScrollContainer(modalRoot);
      if (!scrollContainer) {
        return;
      }

      const localScrollableAncestor = findScrollableAncestor(target, modalRoot);
      if (localScrollableAncestor) {
        return;
      }

      const maxScrollTop =
        scrollContainer.scrollHeight - scrollContainer.clientHeight;

      if (maxScrollTop <= 0) {
        return;
      }

      const nextScrollTop = Math.max(
        0,
        Math.min(scrollContainer.scrollTop + event.deltaY, maxScrollTop),
      );

      if (nextScrollTop === scrollContainer.scrollTop) {
        return;
      }

      event.preventDefault();
      scrollContainer.scrollTop = nextScrollTop;
    };

    document.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", handleWheel, {
        capture: true,
      });
    };
  }, []);
};

export default useModalWheelBridge;
