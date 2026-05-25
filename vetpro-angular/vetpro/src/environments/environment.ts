const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // Si estamos usando el servidor de desarrollo local de Angular (usualmente puerto 4200 sin Nginx)
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '4200') {
      return 'http://localhost:3000/api/v1';
    }
  }
  // Para Docker (Nginx en puerto 8082), acceso móvil y producción real, usamos la ruta relativa
  return '/api/v1';
};

export const environment = {
  production: false,
  apiUrl: getApiUrl()
};
