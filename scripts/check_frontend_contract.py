#!/usr/bin/env python3
"""
Comprobaciones estáticas frontend ↔ backend (se ejecuta en CI).

1. Cada llamada del frontend a la API (api.get/post/put/patch/delete) debe
   existir como ruta en el backend (mismo método y patrón de URL).
2. Cada <form (ngSubmit)> debe estar ligado a un formulario: [formGroup] en la
   propia etiqueta, o FormsModule importado en el componente (NgForm). Sin eso,
   Angular nunca dispara ngSubmit y el botón no envía nada — el fallo que dejó a
   las clínicas sin poder registrar mascotas (2026-09-30).

Uso: python3 scripts/check_frontend_contract.py   (exit 1 si hay problemas)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BE = ROOT / 'vetpro-backend/src'
FE = ROOT / 'vetpro-angular/vetpro/src/app'

# Llamadas del frontend que se sabe que no tienen ruta y no usa ningún componente.
# Añadir aquí solo con justificación.
ALLOWED_UNMATCHED = {
    ('PATCH', '/api/v1/appointments/X/cancel'),        # AppointmentService.cancel: sin uso (se cancela con PATCH /:id/status)
    ('GET', '/api/v1/inventory/purchase-orders'),      # órdenes de compra: sin pantalla todavía
    ('POST', '/api/v1/inventory/purchase-orders'),
    ('PATCH', '/api/v1/inventory/purchase-orders/X/receive'),
}


def backend_routes():
    app = (BE / 'app.ts').read_text()
    imports = {v: f.replace('.js', '') for v, f in
               re.findall(r"import\s+\{\s*(\w+)\s*\}\s+from\s+'\./routes/([\w.\-/]+)'", app)}
    routes = []
    for mount, var in re.findall(r"app\.use\('(/api/v1[^']*)',\s*(\w+)\)", app):
        f = imports.get(var)
        if not f:
            continue
        src = (BE / 'routes' / f'{f}.ts').read_text()
        # router.get('/x', ...) y router.get(['/a', '/b'], ...)
        for method, arg in re.findall(r"^\s*\w+\.(get|post|put|patch|delete)\(\s*(\[[^\]]*\]|['`][^'`]+['`])", src, re.M):
            for p in re.findall(r"['`]([^'`]+)['`]", arg):
                full = re.sub(r'/+', '/', mount + ('' if p == '/' else p)).rstrip('/')
                rx = '^' + re.sub(r'\\:\w+|:\w+', '[^/]+', re.escape(full)) + '$'
                routes.append((method.upper(), re.compile(rx)))
    return routes


def frontend_calls():
    calls = []
    for ts in FE.rglob('*.ts'):
        if ts.name.endswith('.spec.ts') or ts.name == 'api.service.ts':
            continue
        src = ts.read_text()
        for m in re.finditer(r"\b(?:api|http)\.(get|getPaged|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(['`])(.*?)\2", src, re.S):
            method = 'GET' if m.group(1) == 'getPaged' else m.group(1).upper()
            path = re.sub(r'^\$\{[^}]*\}(?=/)', '', m.group(3))  # ${this.base}/...
            path = path.split('?')[0]
            path = re.sub(r'(?<=[^/])\$\{[^}]+\}$', '', path)  # /logs${qs}: query string
            path = re.sub(r'\$\{[^}]+\}', 'X', path)
            path = re.sub(r'/+', '/', '/api/v1' + ('' if path.startswith('/') else '/') + path).rstrip('/')
            line = src[:m.start()].count('\n') + 1
            calls.append((method, path, f'{ts.relative_to(ROOT)}:{line}'))
    return calls


def unbound_forms():
    problems = []
    for html in FE.rglob('*.html'):
        src = html.read_text()
        for m in re.finditer(r'<form\b[^>]*>', src):
            tag = m.group(0)
            if '(ngSubmit)' not in tag or '[formGroup]' in tag:
                continue
            comp = html.with_suffix('.ts')
            imports_forms = comp.exists() and re.search(r'\bFormsModule\b', comp.read_text())
            if not imports_forms:
                line = src[:m.start()].count('\n') + 1
                problems.append(f'{html.relative_to(ROOT)}:{line}: <form (ngSubmit)> sin [formGroup] ni FormsModule — ngSubmit nunca se dispara')
    return problems


def main():
    routes = backend_routes()
    errors = []
    for method, path, where in frontend_calls():
        if (method, path) in ALLOWED_UNMATCHED:
            continue
        if not any(m == method and rx.match(path) for m, rx in routes):
            errors.append(f'{where}: {method} {path} no existe en el backend')
    errors += unbound_forms()

    for e in errors:
        print(e)
    print(f'{len(routes)} rutas backend revisadas; {len(errors)} problema(s).')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
