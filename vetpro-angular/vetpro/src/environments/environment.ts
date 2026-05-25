const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // Si estamos usando el servidor de desarrollo local de Angular (puerto 4200),
    // redirigimos al puerto 3000 de ese mismo host para soportar acceso móvil y local.
    if (port === '4200') {
      return `http://${hostname}:3000/api/v1`;
    }
  }
  // Para Docker (Nginx), acceso móvil y producción real, usamos la ruta relativa
  return '/api/v1';
};

export const environment = {
  production: false,
  apiUrl: getApiUrl()
};

