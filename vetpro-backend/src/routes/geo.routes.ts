import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

// GET /geo/departamentos (público — se usa en el registro, antes de iniciar sesión)
router.get('/departamentos', async (_req, res) => {
  try {
    const departamentos = await prisma.departamento.findMany({
      orderBy: { nombre: 'asc' }
    });
    return res.json(departamentos);
  } catch (error) {
    console.error('Error en /geo/departamentos:', error);
    return res.status(500).json({ error: 'Error al consultar departamentos.' });
  }
});

// GET /geo/municipios?deptoCode=05 (público)
router.get('/municipios', async (req, res) => {
  const { deptoCode } = req.query;

  if (!deptoCode || typeof deptoCode !== 'string') {
    return res.status(400).json({ error: 'Parámetro deptoCode es obligatorio.' });
  }

  try {
    const municipios = await prisma.municipio.findMany({
      where: { deptoCode },
      orderBy: { nombre: 'asc' }
    });
    return res.json(municipios);
  } catch (error) {
    console.error('Error en /geo/municipios:', error);
    return res.status(500).json({ error: 'Error al consultar municipios.' });
  }
});

export const GEO_ROUTES = router;
