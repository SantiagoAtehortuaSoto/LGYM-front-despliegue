import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

import Logo from "../../../assets/LGYM_logo.png";
import calendarIcon from "../../../assets/calendario_comprobante.png";
import orderIcon from "../../../assets/Orden_comprobante.png";

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  headerCard: {
    backgroundColor: "#ffffff",
    border: "1.5px solid #111827",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "70%",
  },
  logo: {
    width: 52,
    height: 52,
    marginRight: 10,
  },
  brandName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "bold",
  },
  brandSubtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 9,
  },
  headerTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
  },
  orderPill: {
    marginTop: 6,
    alignSelf: "flex-end",
    backgroundColor: "#dc2626",
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  orderPillText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaCard: {
    width: "48.5%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metaTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaIcon: {
    width: 14,
    height: 14,
    marginRight: 5,
  },
  metaLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  metaValue: {
    marginTop: 3,
    fontSize: 10,
    color: "#0f172a",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 6,
  },
  table: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
  },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#fee2e2",
    borderBottom: "1px solid #fecaca",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowAlt: {
    backgroundColor: "#fcfcfd",
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#7f1d1d",
  },
  colProduct: {
    width: "46%",
    fontSize: 10,
    color: "#111827",
    paddingRight: 8,
  },
  colPrice: {
    width: "18%",
    textAlign: "right",
    fontSize: 10,
    color: "#334155",
  },
  colQty: {
    width: "14%",
    textAlign: "center",
    fontSize: 10,
    color: "#334155",
  },
  colTotal: {
    width: "22%",
    textAlign: "right",
    fontSize: 10,
    color: "#0f172a",
    fontWeight: "bold",
  },
  emptyState: {
    paddingVertical: 18,
    textAlign: "center",
    color: "#64748b",
    fontSize: 10,
  },
  totalsWrapper: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsCard: {
    width: 250,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    color: "#334155",
    fontSize: 10,
  },
  totalsDivider: {
    borderTop: "1px solid #cbd5e1",
    marginTop: 2,
    marginBottom: 7,
  },
  totalsGrandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalsGrandLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#7f1d1d",
  },
  totalsGrandValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  claimNotice: {
    marginTop: 14,
    padding: 10,
    border: "1px solid #fdba74",
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  claimBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f97316",
    color: "#ffffff",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 8,
  },
  claimBody: {
    width: "94%",
  },
  claimTitle: {
    color: "#9a3412",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  claimText: {
    color: "#9a3412",
    fontSize: 9,
    lineHeight: 1.35,
  },
  footer: {
    marginTop: 18,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 10,
    textAlign: "center",
  },
  footerMain: {
    fontSize: 9,
    color: "#475569",
  },
  footerSub: {
    marginTop: 2,
    fontSize: 8,
    color: "#94a3b8",
  },
});

const ComprobanteDocumento = ({ items, subtotal, total }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const now = new Date();
  const numeroPedido = `NEF-${Date.now().toString().slice(-6)}`;
  const fecha = now.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const hora = now.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const subtotalValue = safeNumber(subtotal);
  const totalValue = safeNumber(total);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.brandRow}>
              <Image style={styles.logo} src={Logo} />
              <View>
                <Text style={styles.brandName}>Nueva Era Fittness</Text>
                <Text style={styles.brandSubtitle}>Orden de compra oficial</Text>
              </View>
            </View>
            <View>
              <Text style={styles.headerTitle}>ORDEN</Text>
              <View style={styles.orderPill}>
                <Text style={styles.orderPillText}>{numeroPedido}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <View style={styles.metaTopRow}>
              <Image style={styles.metaIcon} src={calendarIcon} />
              <Text style={styles.metaLabel}>FECHA Y HORA DE EMISION</Text>
            </View>
            <Text style={styles.metaValue}>{fecha}</Text>
            <Text style={styles.metaValue}>{hora}</Text>
          </View>

          <View style={styles.metaCard}>
            <View style={styles.metaTopRow}>
              <Image style={styles.metaIcon} src={orderIcon} />
              <Text style={styles.metaLabel}>DETALLE DE ORDEN</Text>
            </View>
            <Text style={styles.metaValue}>{safeItems.length} item(s) registrados</Text>
            <Text style={styles.metaValue}>Estado: Generada</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalle de productos</Text>
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={[styles.colProduct, styles.tableHeaderText]}>Producto</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Precio</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Cant.</Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>Total</Text>
          </View>
          {safeItems.length === 0 ? (
            <Text style={styles.emptyState}>No hay productos en esta orden.</Text>
          ) : (
            safeItems.map((item, i) => {
              const precio = safeNumber(item?.precio);
              const cantidad = safeNumber(item?.cantidad) || 1;
              const totalLinea = precio * cantidad;

              return (
                <View
                  style={[styles.row, i % 2 === 1 && styles.rowAlt]}
                  key={`${item?.id ?? item?.nombre ?? "item"}-${i}`}
                >
                  <Text style={styles.colProduct}>{item?.nombre || "Producto"}</Text>
                  <Text style={styles.colPrice}>{formatCurrency(precio)}</Text>
                  <Text style={styles.colQty}>{cantidad}</Text>
                  <Text style={styles.colTotal}>{formatCurrency(totalLinea)}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.totalsWrapper}>
          <View style={styles.totalsCard}>
            <View style={styles.totalsLine}>
              <Text>Subtotal</Text>
              <Text>{formatCurrency(subtotalValue)}</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsGrandRow}>
              <Text style={styles.totalsGrandLabel}>TOTAL</Text>
              <Text style={styles.totalsGrandValue}>{formatCurrency(totalValue)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.claimNotice}>
          <Text style={styles.claimBadge}>!</Text>
          <View style={styles.claimBody}>
            <Text style={styles.claimTitle}>Plazo de reclamo</Text>
            <Text style={styles.claimText}>
              Esta orden tiene un plazo maximo de reclamo de 3 dias calendario
              a partir de su fecha de emision.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerMain}>
            Gracias por tu compra en Nueva Era Fittness.
          </Text>
          <Text style={styles.footerSub}>
            Documento generado automaticamente por el sistema NEF.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default ComprobanteDocumento;
