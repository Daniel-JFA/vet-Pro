import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

async function runTests() {
  console.log('🧪 INICIANDO PRUEBAS DE INTEGRACIÓN AUTOMATIZADAS DE QA — VETPRO API 🧪');
  console.log('======================================================================');

  let adminToken = '';
  let tutorToken = '';

  // ---------------------------------------------------------------------------
  // 1. Verificar documentación OpenAPI / Swagger
  // ---------------------------------------------------------------------------
  try {
    console.log('\n📖 [TEST 1] Verificando documentación OpenAPI en `/docs`...');
    const res = await fetch(`${BASE_URL}/docs`);
    assert.strictEqual(res.status, 200, 'Swagger UI no está disponible.');
    const text = await res.text();
    assert.ok(text.includes('Swagger'), 'El contenido de la página no parece ser Swagger UI.');
    console.log('✅ [TEST 1] Exitoso: Swagger UI está activo y responde correctamente.');
  } catch (err: any) {
    console.error('❌ [TEST 1] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 2. Autenticación — Login con credenciales por defecto (Éxito)
  // ---------------------------------------------------------------------------
  try {
    console.log('\n🔑 [TEST 2] Verificando inicio de sesión de Admin con credenciales por defecto...');
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vetpro.co', password: 'admin123' })
    });
    
    assert.strictEqual(res.status, 200, `No se pudo iniciar sesión con las credenciales demo. ${res.status} !== 200`);
    const data: any = await res.json();
    assert.ok(data.token, 'El token de sesión no fue devuelto.');
    assert.strictEqual(data.user.role, 'admin', 'El rol de usuario no es "admin".');
    assert.ok(data.clinic?.id, 'La clínica asociada no existe.');
    
    adminToken = data.token;
    console.log('✅ [TEST 2] Exitoso: Login de Admin validado. Token JWT obtenido.');
  } catch (err: any) {
    console.error('❌ [TEST 2] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 3. Autenticación — Login con credenciales inválidas (Fallo controlado)
  // ---------------------------------------------------------------------------
  try {
    console.log('\n❌ [TEST 3] Verificando login fallido con contraseña incorrecta...');
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vetpro.co', password: 'password_incorrecta' })
    });
    
    assert.strictEqual(res.status, 401, 'Se permitió el acceso con contraseña incorrecta.');
    const data: any = await res.json();
    assert.strictEqual(data.error, 'Credenciales inválidas.', 'El mensaje de error no es el esperado.');
    console.log('✅ [TEST 3] Exitoso: Se denegó el acceso correctamente (401 Autorización fallida).');
  } catch (err: any) {
    console.error('❌ [TEST 3] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 4. Autenticación — Sesión activa `/auth/me` con JWT
  // ---------------------------------------------------------------------------
  try {
    console.log('\n👤 [TEST 4] Verificando ruta de perfil `/auth/me` con token JWT válido...');
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    assert.strictEqual(res.status, 200, 'No se pudo obtener el perfil de usuario activo.');
    const data: any = await res.json();
    assert.strictEqual(data.user.email, 'admin@vetpro.co', 'El correo en el perfil no coincide.');
    console.log('✅ [TEST 4] Exitoso: JWT decodificado en el servidor. Perfil devuelto.');
  } catch (err: any) {
    console.error('❌ [TEST 4] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 5. Sedes Físicas — `/branches`
  // ---------------------------------------------------------------------------
  try {
    console.log('\n🏢 [TEST 5] Verificando sucursales `/branches`...');
    const res = await fetch(`${API_URL}/branches`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    assert.strictEqual(res.status, 200, 'Falló la obtención de sucursales.');
    const branches: any = await res.json();
    assert.ok(Array.isArray(branches), 'Las sucursales devueltas no son un arreglo.');
    assert.ok(branches.length > 0, 'El arreglo de sucursales está vacío.');
    assert.ok(branches[0].name, 'La sucursal no tiene nombre configurado.');
    console.log(`✅ [TEST 5] Exitoso: Se devolvieron ${branches.length} sucursales activas.`);
  } catch (err: any) {
    console.error('❌ [TEST 5] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 6. Pacientes — `/patients`
  // ---------------------------------------------------------------------------
  try {
    console.log('\n🐾 [TEST 6] Verificando expedientes de pacientes `/patients`...');
    const res = await fetch(`${API_URL}/patients`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    assert.strictEqual(res.status, 200, 'Falló la obtención de expedientes de pacientes.');
    const result: any = await res.json();
    assert.ok(Array.isArray(result.data), 'Los pacientes devueltos no son un arreglo.');
    assert.ok(result.total > 0, 'La cantidad de pacientes reportada es cero.');
    
    const toby = result.data.find((p: any) => p.name === 'Toby');
    assert.ok(toby, 'El paciente "Toby" no está en la lista.');
    assert.strictEqual(toby.species, 'dog', 'La especie de Toby no es "dog".');
    console.log(`✅ [TEST 6] Exitoso: ${result.total} pacientes cargados correctamente con relaciones.`);
  } catch (err: any) {
    console.error('❌ [TEST 6] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 7. Citas — `/appointments` y `/appointments/today`
  // ---------------------------------------------------------------------------
  try {
    console.log('\n📅 [TEST 7] Verificando agenda de citas y citas de hoy...');
    const resAll = await fetch(`${API_URL}/appointments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAll.status, 200, 'Falló la obtención de todas las citas.');
    const resultAll: any = await resAll.json();
    assert.ok(resultAll.data.length > 0, 'La lista de citas está vacía.');

    const resToday = await fetch(`${API_URL}/appointments/today`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resToday.status, 200, 'Falló la obtención de citas de hoy.');
    const appointmentsToday: any = await resToday.json();
    assert.ok(Array.isArray(appointmentsToday), 'Las citas de hoy no son un arreglo.');
    
    console.log(`✅ [TEST 7] Exitoso: Citas totales (${resultAll.total}) y de hoy (${appointmentsToday.length}) recuperadas.`);
  } catch (err: any) {
    console.error('❌ [TEST 7] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 8. Facturación — `/billing/invoices` y `/billing/summary`
  // ---------------------------------------------------------------------------
  try {
    console.log('\n💰 [TEST 8] Verificando facturas e indicadores financieros...');
    const resInvoices = await fetch(`${API_URL}/billing/invoices`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resInvoices.status, 200, 'Falló la obtención de facturas.');
    const resultInvoices: any = await resInvoices.json();
    assert.ok(resultInvoices.data.length > 0, 'No se retornaron facturas.');

    const resSummary = await fetch(`${API_URL}/billing/summary`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resSummary.status, 200, 'Falló el resumen de facturación.');
    const summary: any = await resSummary.json();
    assert.ok(summary.totalInvoiced >= 0, 'Los indicadores financieros son inválidos.');
    
    console.log(`✅ [TEST 8] Exitoso: Facturas cargadas ($${summary.totalInvoiced.toLocaleString('es-CO')}) y KPIs validados.`);
  } catch (err: any) {
    console.error('❌ [TEST 8] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 9. Portal de Tutores — Solicitud de Link Mágico
  // ---------------------------------------------------------------------------
  let magicLinkToken = '';
  try {
    console.log('\n📲 [TEST 9] Solicitando enlace mágico para Tutor...');
    const res = await fetch(`${API_URL}/portal/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '3122115299' })
    });
    
    assert.strictEqual(res.status, 200, 'No se pudo solicitar el link mágico.');
    const data: any = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.magicLink, 'El link mágico no fue devuelto en desarrollo.');
    
    const url = new URL(data.magicLink);
    magicLinkToken = url.searchParams.get('token') || '';
    assert.ok(magicLinkToken, 'No se pudo extraer el token temporal del link mágico.');
    console.log('✅ [TEST 9] Exitoso: Enlace mágico generado. Token de acceso extraído.');
  } catch (err: any) {
    console.error('❌ [TEST 9] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 10. Portal de Tutores — Verificación de Enlace Mágico por Token de Sesión
  // ---------------------------------------------------------------------------
  try {
    console.log('\n🔒 [TEST 10] Intercambiando link mágico por sesión de Tutor...');
    const res = await fetch(`${API_URL}/portal/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magicLinkToken })
    });
    
    assert.strictEqual(res.status, 200, 'El token del enlace mágico no es válido.');
    const data: any = await res.json();
    assert.ok(data.token, 'El token final de sesión del tutor no fue devuelto.');
    assert.ok(data.tutor?.firstName, 'El tutor autenticado no tiene nombre.');
    
    tutorToken = data.token;
    console.log(`✅ [TEST 10] Exitoso: Autenticación Passwordless de Tutor (${data.tutor.firstName}) validada.`);
  } catch (err: any) {
    console.error('❌ [TEST 10] Falló:', err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // 11. Portal de Tutores — Datos del Tutor Autenticado
  // ---------------------------------------------------------------------------
  try {
    console.log('\n🏡 [TEST 11] Cargando datos de mascotas del Tutor utilizando JWT del Tutor...');
    const res = await fetch(`${API_URL}/portal/patients`, {
      headers: { 'Authorization': `Bearer ${tutorToken}` }
    });
    
    assert.strictEqual(res.status, 200, 'No se pudo ingresar al portal del tutor.');
    const patients: any = await res.json();
    assert.ok(Array.isArray(patients), 'Las mascotas devueltas no son un arreglo.');
    assert.ok(patients.length > 0, 'La lista de mascotas del tutor está vacía.');
    console.log(`✅ [TEST 11] Exitoso: Datos del Portal del Tutor (${patients.length} mascotas) extraídos correctamente.`);
  } catch (err: any) {
    console.error('❌ [TEST 11] Falló:', err.message);
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('🏆 ¡TODAS LAS PRUEBAS DE QA AUTOMATIZADAS PASARON EXITOSAMENTE (11/11)! 🏆');
  console.log('🛡️  VetPro SaaS certificado con altos niveles de calidad y robustez.   🛡️');
  console.log('======================================================================');
}

runTests();
