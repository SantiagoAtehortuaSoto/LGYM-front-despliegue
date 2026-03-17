import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

const BuscadorUniversal = ({
  value,
  onChange,
  placeholder = "Buscar",
  className = "",
  onEnterPress = null,
  onSearch = null,
  inputClassName = "",
  buttonClassName = "",
}) => {
  const [draftValue, setDraftValue] = useState(value ?? "");

  const isExternallyControlled = useMemo(
    () => typeof onEnterPress === "function" || typeof onSearch === "function",
    [onEnterPress, onSearch],
  );

  useEffect(() => {
    if (!isExternallyControlled) {
      setDraftValue(value ?? "");
    }
  }, [isExternallyControlled, value]);

  const currentValue = isExternallyControlled ? value ?? "" : draftValue;

  const commitSearch = (nextValue) => {
    if (typeof onChange === "function") {
      onChange(nextValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    if (isExternallyControlled) {
      if (onEnterPress) {
        onEnterPress(currentValue);
        return;
      }

      if (onSearch) {
        onSearch(currentValue);
      }
      return;
    }

    commitSearch(currentValue);
  };

  const handleChange = (e) => {
    const nextValue = e.target.value;

    if (isExternallyControlled) {
      commitSearch(nextValue);
      return;
    }

    setDraftValue(nextValue);
  };

  const handleSearchClick = () => {
    if (isExternallyControlled) {
      if (onSearch) {
        onSearch(currentValue);
        return;
      }

      if (onEnterPress) {
        onEnterPress(currentValue);
      }
      return;
    }

    commitSearch(currentValue);
  };

  return (
    <div className={`contenedor-busqueda ${className}`}>
      <button
        type="button"
        className={`icono-busqueda ${buttonClassName}`.trim()}
        onClick={handleSearchClick}
        aria-label="Ejecutar búsqueda"
      >
        <Search size={18} />
      </button>
      <input
        type="text"
        className={`campo-busqueda ${inputClassName}`.trim()}
        placeholder={placeholder}
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export default BuscadorUniversal;
