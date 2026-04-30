# Guía de Creación de Módulos Frontend en Backstage

Esta guía documenta el estándar para crear módulos y páginas personalizadas en Backstage usando el **Nuevo Sistema Frontend** (v1.50+).

## 📋 Tabla de Contenidos

- [Conceptos Clave](#conceptos-clave)
- [Estructura Correcta de Extensiones](#estructura-correcta-de-extensiones)
- [Ejemplo Completo](#ejemplo-completo)
- [Errores Comunes y Soluciones](#errores-comunes-y-soluciones)
- [Integración con Sidebar](#integración-con-sidebar)
- [Mejores Prácticas](#mejores-prácticas)

---

## Conceptos Clave

### Sistema de Extensiones de Backstage

En el nuevo sistema frontend de Backstage (v1.50+), todo se basa en **extensiones**:

- **Extensión**: Unidad básica que proporciona funcionalidad
- **Output**: Datos que una extensión proporciona (debe ser un **array**)
- **Factory**: Función que crea y retorna los outputs (debe retornar un **array**)
- **AttachTo**: Define dónde se conecta la extensión en la aplicación

### Datos de Extensión Core

```typescript
import { coreExtensionData } from '@backstage/frontend-plugin-api';

// Datos disponibles:
coreExtensionData.reactElement  // Componente React
coreExtensionData.routePath     // Ruta de la página
coreExtensionData.title         // Título
coreExtensionData.icon          // Ícono
```

---

## Estructura Correcta de Extensiones

### ✅ Forma CORRECTA de crear una extensión de página

```typescript
import React from 'react';
import { 
  createExtension,
  coreExtensionData,
} from '@backstage/frontend-plugin-api';

const myCustomPage = createExtension({
  namespace: 'app',                              // Namespace del plugin
  name: 'my-custom-page',                        // Nombre único de la extensión
  attachTo: { id: 'app/routes', input: 'routes' }, // Conectar a las rutas de la app
  
  // ⚠️ CRÍTICO: output debe ser un ARRAY
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  
  // ⚠️ CRÍTICO: factory debe retornar un ARRAY
  factory() {
    // Usar React.lazy para lazy loading
    const LazyComponent = React.lazy(() => 
      import('./components/MyComponent').then(m => ({ 
        default: m.MyComponent 
      }))
    );
    
    // Retornar array con los datos envueltos en las funciones correspondientes
    return [
      coreExtensionData.reactElement(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      ),
      coreExtensionData.routePath('/my-custom-page'),
    ];
  },
});
```

### ❌ Formas INCORRECTAS (NO usar)

#### Error 1: Output como objeto en lugar de array
```typescript
// ❌ INCORRECTO
output: {
  element: coreExtensionData.reactElement,
  path: coreExtensionData.routePath,
}

// ✅ CORRECTO
output: [
  coreExtensionData.reactElement,
  coreExtensionData.routePath,
]
```

#### Error 2: Factory retorna objeto en lugar de array
```typescript
// ❌ INCORRECTO
factory() {
  return {
    element: <MyComponent />,
    path: '/my-page',
  };
}

// ✅ CORRECTO
factory() {
  return [
    coreExtensionData.reactElement(<MyComponent />),
    coreExtensionData.routePath('/my-page'),
  ];
}
```

#### Error 3: Usar PageBlueprint incorrectamente
```typescript
// ❌ INCORRECTO - PageBlueprint puede causar errores de output
import { PageBlueprint } from '@backstage/frontend-plugin-api';

const page = PageBlueprint.make({
  params: {
    defaultPath: '/my-page',
    loader: () => import('./MyComponent'),
  },
});

// ✅ CORRECTO - Usar createExtension directamente
const page = createExtension({
  namespace: 'app',
  name: 'my-page',
  attachTo: { id: 'app/routes', input: 'routes' },
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  factory() {
    const LazyComponent = React.lazy(() => 
      import('./MyComponent').then(m => ({ default: m.MyComponent }))
    );
    return [
      coreExtensionData.reactElement(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      ),
      coreExtensionData.routePath('/my-page'),
    ];
  },
});
```

---

## Ejemplo Completo

### Archivo: `packages/app/src/App.tsx`

```typescript
import React from 'react';
import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { 
  createExtension,
  coreExtensionData,
} from '@backstage/frontend-plugin-api';

console.log('🟢 App.tsx: Loading app');

// Crear extensión de página personalizada
const myCustomPage = createExtension({
  namespace: 'app',
  name: 'my-custom-page',
  attachTo: { id: 'app/routes', input: 'routes' },
  output: [
    coreExtensionData.reactElement,
    coreExtensionData.routePath,
  ],
  factory() {
    console.log('🔵 Creating My Custom Page extension');
    const LazyComponent = React.lazy(() => 
      import('./components/MyCustomPage').then(m => ({ 
        default: m.MyCustomPage 
      }))
    );
    return [
      coreExtensionData.reactElement(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      ),
      coreExtensionData.routePath('/my-custom-page'),
    ];
  },
});

// Crear módulo que agrupa las extensiones
const customModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    myCustomPage,
    // Agregar más extensiones aquí
  ],
});

console.log('🟢 Custom Module created');

// Exportar la aplicación con todos los módulos
export default createApp({
  features: [
    catalogPlugin,
    navModule,
    customModule, // Agregar el módulo personalizado
  ],
});
```

### Archivo: `packages/app/src/components/MyCustomPage.tsx`

```typescript
import React from 'react';
import { Header, Page, Content } from '@backstage/core-components';

export const MyCustomPage = () => {
  return (
    <Page themeId="tool">
      <Header title="My Custom Page" subtitle="Description of the page" />
      <Content>
        <div>
          <h2>Welcome to My Custom Page</h2>
          <p>This is a custom page in Backstage.</p>
        </div>
      </Content>
    </Page>
  );
};
```

---

## Errores Comunes y Soluciones

### Error 1: `EXTENSION_OUTPUT_MISSING: missing required extension data output 'core.routing.path'`

**Causa**: El output no está definido correctamente o falta `routePath`.

**Solución**:
```typescript
// Asegúrate de incluir ambos outputs
output: [
  coreExtensionData.reactElement,
  coreExtensionData.routePath,  // ← Este es necesario
]

// Y retornarlos en el factory
factory() {
  return [
    coreExtensionData.reactElement(<Component />),
    coreExtensionData.routePath('/my-path'),  // ← Este es necesario
  ];
}
```

### Error 2: `EXTENSION_FACTORY_ERROR: extension factory did not provide an iterable object`

**Causa**: El factory está retornando un objeto en lugar de un array.

**Solución**:
```typescript
// ❌ INCORRECTO
factory() {
  return {
    element: <Component />,
    path: '/path',
  };
}

// ✅ CORRECTO
factory() {
  return [
    coreExtensionData.reactElement(<Component />),
    coreExtensionData.routePath('/path'),
  ];
}
```

### Error 3: `TypeError: internalExtension.output is not iterable`

**Causa**: El output está definido como objeto en lugar de array.

**Solución**:
```typescript
// ❌ INCORRECTO
output: {
  element: coreExtensionData.reactElement,
  path: coreExtensionData.routePath,
}

// ✅ CORRECTO
output: [
  coreExtensionData.reactElement,
  coreExtensionData.routePath,
]
```

### Error 4: `Module 'aws-pages' provided duplicate extensions: page:aws-pages`

**Causa**: Múltiples extensiones con el mismo ID o usando `PageBlueprint.make` sin nombres únicos.

**Solución**:
```typescript
// Asegúrate de que cada extensión tenga un nombre único
const page1 = createExtension({
  namespace: 'app',
  name: 'page-1',  // ← Nombre único
  // ...
});

const page2 = createExtension({
  namespace: 'app',
  name: 'page-2',  // ← Nombre único diferente
  // ...
});
```

---

## Integración con Sidebar

Para que las páginas aparezcan en el sidebar, actualiza el archivo de navegación:

### Archivo: `packages/app/src/modules/nav/Sidebar.tsx`

```typescript
import CloudIcon from '@material-ui/icons/Cloud';

// Dentro del SidebarGroup
<SidebarItem 
  icon={CloudIcon} 
  to="/my-custom-page"  // ← Debe coincidir con routePath
  text="My Custom Page" 
/>
```

**⚠️ IMPORTANTE**: 
- NO uses rutas con `.html` (ej: `/my-page.html`)
- Usa rutas de React directamente (ej: `/my-page`)
- La ruta debe coincidir exactamente con el `routePath` definido en la extensión

---

## Mejores Prácticas

### 1. Usar Lazy Loading

Siempre usa `React.lazy` y `Suspense` para cargar componentes de forma eficiente:

```typescript
const LazyComponent = React.lazy(() => 
  import('./components/MyComponent').then(m => ({ 
    default: m.MyComponent 
  }))
);

return [
  coreExtensionData.reactElement(
    <React.Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </React.Suspense>
  ),
  coreExtensionData.routePath('/my-page'),
];
```

### 2. Agregar Logs para Debugging

Incluye logs en puntos clave para facilitar el debugging:

```typescript
console.log('🟢 App.tsx: Loading app');

factory() {
  console.log('🔵 Creating My Custom Page extension');
  // ...
}

console.log('🟢 Custom Module created');
```

### 3. Agrupar Extensiones Relacionadas

Agrupa extensiones relacionadas en un solo módulo:

```typescript
const awsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    awsResourcesPage,
    awsPipelinesPage,
    awsCostsPage,
  ],
});
```

### 4. Nombres Descriptivos

Usa nombres descriptivos y únicos para las extensiones:

```typescript
// ✅ BUENO
name: 'aws-resources'
name: 'aws-pipelines'
name: 'aws-costs'

// ❌ MALO
name: 'page1'
name: 'page2'
name: 'page3'
```

### 5. Estructura de Archivos

Organiza los componentes de forma clara:

```
packages/app/src/
├── App.tsx                          # Configuración principal
├── components/
│   ├── aws/
│   │   ├── AwsResourcesPage.tsx
│   │   ├── AwsPipelinesPage.tsx
│   │   ├── AwsCostsPage.tsx
│   │   └── index.ts
│   └── ...
└── modules/
    ├── nav/
    │   └── Sidebar.tsx
    └── ...
```

---

## Checklist de Verificación

Antes de crear una nueva extensión, verifica:

- [ ] `output` es un **array** (no un objeto)
- [ ] `factory` retorna un **array** (no un objeto)
- [ ] Incluyes `coreExtensionData.reactElement` en output
- [ ] Incluyes `coreExtensionData.routePath` en output
- [ ] Usas `React.lazy` para lazy loading
- [ ] Envuelves el componente en `React.Suspense`
- [ ] El nombre de la extensión es único
- [ ] La ruta en el sidebar coincide con `routePath`
- [ ] NO usas rutas con `.html`
- [ ] Agregaste logs para debugging

---

## Referencias

- [Documentación oficial de Backstage - Frontend System](https://backstage.io/docs/frontend-system/)
- [Building Frontend Plugins](https://backstage.io/docs/frontend-system/building-plugins/)
- [Common Extension Blueprints](https://backstage.io/docs/frontend-system/building-plugins/common-extension-blueprints)
- [Built-in Data Refs](https://backstage.io/docs/frontend-system/building-plugins/built-in-data-refs/)

---

## Historial de Cambios

- **2026-04-30**: Documento inicial creado basado en la implementación de módulos AWS
