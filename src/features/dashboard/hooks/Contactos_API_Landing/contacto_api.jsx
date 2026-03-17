import { buildUrl } from "../apiConfig";

const URL_CONTACTOS_API_LANDING = buildUrl("/contactanos");

async function enviarContacto({ nombre, email, telefono, mensaje }) {
  const res = await fetch(URL_CONTACTOS_API_LANDING, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre,
      email,
      telefono,
      mensaje,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${errorBody || "No se pudo enviar el contacto"}`);
  }

  return res.json().catch(() => ({})); 
}
export default enviarContacto;


