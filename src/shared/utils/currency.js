const DEFAULT_LOCALE = "es-CO";
const DEFAULT_CURRENCY = "COP";

const normalizeCurrencyValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return 0;

  let text = String(value).trim();
  if (!text) return 0;

  text = text.replace(/[^\d,.-]/g, "");
  if (!text) return 0;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, "");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildCurrencyFormatter = ({
  compact = false,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
} = {}) =>
  new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    currencyDisplay: "code",
    notation: compact ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
  });

export const toCurrencyNumber = normalizeCurrencyValue;

export const formatCurrencyCOP = (value, options = {}) => {
  const formatter = buildCurrencyFormatter(options);
  return formatter.format(normalizeCurrencyValue(value));
};

export const formatCurrencyCOPCompact = (value, options = {}) =>
  formatCurrencyCOP(value, {
    compact: true,
    maximumFractionDigits: 1,
    ...options,
  });
