import { API_BASE_URL } from "../apiConfig";

const API_URL = API_BASE_URL;

function getAuthToken() {
  return localStorage.getItem("token");
}

async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { message: text || "Error parsing response" };
  }
}

async function apiRequest(endpoint = "/beneficiarios", method = "GET", body = null, headers = {}) {
  const token = getAuthToken();
  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers: { ...defaultHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const responseData = await parseJSON(response);
    
    if (!response.ok) {
      console.error('[ERROR] Error en la respuesta de la API:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        responseData
      });
      
      const error = new Error(
        responseData?.message || responseData?.msg || `Error: ${response.status} ${response.statusText}`
      );
      
      // Añadir detalles adicionales al error
      error.response = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config: { method, url: `${API_URL}${endpoint}`, headers: options.headers, data: body }
      };
      
      throw error;
    }
    
    return responseData;
  } catch (error) {
    console.error('[ERROR] Error en la petición a la API:', {
      message: error.message,
      stack: error.stack,
      request: { method, url: `${API_URL}${endpoint}`, headers: options.headers, data: body }
    });
    
    // Asegurarse de que el error tenga la información de la respuesta si está disponible
    if (!error.response) {
      error.response = {
        data: { message: error.message },
        status: 0,
        statusText: 'Network Error',
        headers: {},
        config: { method, url: `${API_URL}${endpoint}`, headers: options.headers, data: body }
      };
    }
    
    throw error;
  }
}

export async function obtenerBeneficiarios() {
  try {
    const response = await apiRequest("/beneficiarios", "GET");
    return response;
  } catch (error) {
    console.error('[ERROR] Error en obtenerBeneficiarios:', error);
    throw error;
  }
}

export async function crearBeneficiario(payload) {
  try {
    const response = await apiRequest("/beneficiarios", "POST", payload);
    return response;
  } catch (error) {
    console.error('[ERROR] Error en crearBeneficiario:', {
      message: error.message,
      stack: error.stack,
      response: error.response,
      config: error.config
    });
    throw error; // Re-lanzar el error para manejarlo en el componente
  }
}

export async function actualizarBeneficiario(id, payload) {
  return apiRequest(`/beneficiarios/${id}`, "PUT", payload);
}

export async function eliminarBeneficiario(id) {
  return apiRequest(`/beneficiarios/${id}`, "DELETE");
}
