# Publicación de VetPro en vetpro.danielflorez.dev

## Prerequisitos

1. **Red Traefik creada**: Asegúrate que existe la red `proxy` en Docker
   ```bash
   docker network create proxy 2>/dev/null || true
   ```

2. **Traefik corriendo**: El servicio Traefik debe estar activo en `/home/djfa/Dev/projects/MedTurn/infra/traefik`

## Instrucciones de despliegue

### Paso 1: Preparar variables de entorno

```bash
cd /home/djfa/Dev/projects/vet-Pro/stacks/vetpro
cp .env.production .env
# Editar .env con valores de producción seguros
```

### Paso 2: Levantar los servicios

```bash
docker-compose -f docker-compose.yml up -d
```

### Paso 3: Verificar estado

```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

### Paso 4: Validar acceso

- **Frontend**: https://vetpro.danielflorez.dev
- **API Backend**: https://vetpro.danielflorez.dev/api

## Configuración de Traefik

El docker-compose.yml está configurado con los siguientes labels:

- **Frontend**: Enrutado por `Host(vetpro.danielflorez.dev)` con priority 10
- **Backend API**: Enrutado por `Host(vetpro.danielflorez.dev) && PathPrefix(/api)` con priority 100
- Middleware automático que elimina el prefijo `/api` antes de alcanzar el backend

## Logs y troubleshooting

```bash
# Ver logs del backend
docker logs vetpro-backend -f

# Ver logs del frontend
docker logs vetpro-frontend -f

# Ver logs de la base de datos
docker logs vetpro-postgres -f

# Verificar redes
docker network inspect proxy
docker network inspect vetpro-internal
```

## Detener los servicios

```bash
docker-compose down
```

Para eliminar volúmenes persistentes también:
```bash
docker-compose down -v
```
