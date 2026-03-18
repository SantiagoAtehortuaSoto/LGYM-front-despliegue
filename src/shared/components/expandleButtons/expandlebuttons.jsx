import { Dumbbell, ArchiveRestore, ShoppingBag, Settings } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const buildLinkKey = (link, index) =>
  `${link?.url || "sin-ruta"}::${link?.title || index}`;

const ExpandableButtons = ({
  nombreBoton,
  links = [],
  isExpanded: controlledIsExpanded,
  onToggle = null,
}) => {
  const location = useLocation();
  const normalizedLinks = useMemo(
    () => (Array.isArray(links) ? links : []),
    [links],
  );
  const matchingLinkKeys = useMemo(
    () => {
      const linkEntries = normalizedLinks.map((link, index) => ({
        key: buildLinkKey(link, index),
        url: link?.url || "",
      }));
      const exactMatches = linkEntries
        .filter(({ url }) => url && location.pathname === url)
        .map(({ key }) => key);

      if (exactMatches.length > 0) {
        return exactMatches;
      }

      return linkEntries
        .filter(
          ({ url }) => url && location.pathname.startsWith(`${url}/`),
        )
        .map(({ key }) => key);
    },
    [location.pathname, normalizedLinks],
  );
  const hasActiveLink = matchingLinkKeys.length > 0;
  const isControlled = typeof controlledIsExpanded === "boolean";
  const [internalExpanded, setInternalExpanded] = useState(hasActiveLink);
  const isExpanded = isControlled ? controlledIsExpanded : internalExpanded;
  const [activeLinkKey, setActiveLinkKey] = useState(matchingLinkKeys[0] || "");
  const iconMap = {
    Compras: <ArchiveRestore size={20} />,
    Servicios: <Dumbbell size={20} />,
    Ventas: <ShoppingBag size={20} />,
    Configuración: <Settings size={20} />,
  };

  const setExpanded = (value) => {
    const nextValue = typeof value === "function" ? value(isExpanded) : value;
    if (!isControlled) {
      setInternalExpanded(nextValue);
    }
    if (typeof onToggle === "function") {
      onToggle(nextValue);
    }
  };

  useEffect(() => {
    if (!hasActiveLink) return;

    if (isControlled) {
      if (typeof onToggle === "function") onToggle(true);
    } else {
      setInternalExpanded(true);
    }

    setActiveLinkKey((current) =>
      current && matchingLinkKeys.includes(current) ? current : matchingLinkKeys[0],
    );
    // Solo reaccionar a cambios de ruta/coincidencia para no reabrir
    // automáticamente una sección que el usuario acaba de cerrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveLink, matchingLinkKeys]);

  return (
    <div>
      <button
        className={`expandable-button poppins-regular ${isExpanded ? "expanded" : ""} ${
          hasActiveLink ? "is-active" : ""
        }`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="button-content">
          {iconMap[nombreBoton] || null}
          <span className="button-text">{nombreBoton || "Expandir"}</span>
          <svg
            className={`arrow ${isExpanded ? "is-expanded" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
      </button>

      <div className={`links-container ${isExpanded ? "show" : ""}`}>
        {normalizedLinks.map((link, index) => {
          const linkKey = buildLinkKey(link, index);
          const isRouteMatch = matchingLinkKeys.includes(linkKey);
          const isActive =
            isRouteMatch &&
            (!matchingLinkKeys.includes(activeLinkKey) || activeLinkKey === linkKey);

          return (
            <Link
              key={index}
              to={link.url || "#"}
              className={`link-item poppins-regular ${isActive ? "is-active" : ""}`}
              onClick={(e) => {
                if (!link.url) e.preventDefault();
                setActiveLinkKey(linkKey);
                setExpanded(true);
              }}
              rel="noopener noreferrer"
            >
              {link.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ExpandableButtons;
