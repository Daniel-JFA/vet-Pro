const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // Si estamos en desarrollo local (cualquier puerto de Angular dev server ej: 4200, 4201),
    // redirigimos al puerto 3000 de ese mismo host
    if (port && port !== '80' && port !== '443' && port !== '3000') {
      return `http://${hostname}:3000/api/v1`;
    }
  }
  // Para Docker (Nginx), acceso móvil y producción real, usamos la ruta relativa
  return '/api/v1';
};

export const environment = {
  production: false,
  apiUrl: getApiUrl(),
  sentryDsn: (typeof window !== 'undefined' && (window as any)?.__VETPRO_CONFIG__?.SENTRY_DSN) || ''
};

