import { Router, Response, Request } from 'express';

const router = Router();

// HTML del visor interactivo Swagger UI (Cargado por CDN para mantener el proyecto ligero)
const swaggerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>VetPro API v1 — Documentación Oficial</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; font-family: 'Inter', sans-serif; }
    .swagger-ui .topbar { background-color: #111827; border-bottom: 2px solid #10b981; }
    .swagger-ui .topbar .download-url-button { background: #10b981; border-color: #10b981; color: white; }
    .swagger-ui .info .title { color: #111827; font-weight: 800; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      // Configuración de especificaciones OpenAPI v3
      const spec = {
        openapi: "3.0.3",
        info: {
          title: "VetPro SaaS API REST v1",
          description: "Documentación interactiva oficial de los endpoints de la API central de VetPro. Utiliza la cabecera 'Authorization: Bearer <token>' para peticiones protegidas.",
          version: "1.0.0",
          contact: {
            name: "Soporte Técnico VetPro",
            email: "dev@vetpro.co"
          }
        },
        servers: [
          { url: "http://localhost:3000/api/v1", description: "Servidor de Desarrollo Local" }
        ],
        paths: {
          "/auth/login": {
            post: {
              tags: ["Autenticación (Staff)"],
              summary: "Iniciar sesión de Staff",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["email", "password"],
                      properties: {
                        email: { type: "string", example: "admin@vetpro.co" },
                        password: { type: "string", example: "admin123" }
                      }
                    }
                  }
                }
              },
              responses: {
                200: { description: "Autenticación exitosa. Entrega JWT token y metadatos de clínica." }
              }
            }
          },
          "/portal/auth/magic-link": {
            post: {
              tags: ["Portal del Tutor"],
              summary: "Solicitar link mágico de tutor",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["phone"],
                      properties: {
                        phone: { type: "string", example: "3124567890" }
                      }
                    }
                  }
                }
              },
              responses: {
                200: { description: "Enlace generado con éxito." }
              }
            }
          },
          "/patients": {
            get: {
              tags: ["Pacientes & Tutores"],
              summary: "Obtener listado de mascotas paginado",
              responses: {
                200: { description: "Lista de pacientes filtrados." }
              }
            }
          },
          "/medical-records": {
            post: {
              tags: ["Historial Clínico"],
              summary: "Registrar una nueva consulta médica",
              responses: {
                201: { description: "Historia médica creada." }
              }
            }
          },
          "/billing/invoices": {
            get: {
              tags: ["Facturación & Cobros"],
              summary: "Listar facturas emitidas por la clínica",
              responses: {
                200: { description: "Facturas filtradas." }
              }
            }
          },
          "/reports/dashboard": {
            get: {
              tags: ["Reportes & Analíticas"],
              summary: "Métricas consolidadas de KPI y gráficos ejecutivos",
              responses: {
                200: { description: "Metadatos listos para Chart.js." }
              }
            }
          }
        }
      };

      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
`;

// Servir la especificación HTML estática
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  return res.send(swaggerHtml);
});

export { router as DOCS_ROUTES };
