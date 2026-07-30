# CommerceOps AI 🚀
## Plataforma Multiagente para Análisis Operacional de E-Commerce

> **Proyecto de portafolio basado en el dataset público Brazilian E-Commerce Public Dataset by Olist de Kaggle (~100.000 pedidos).**

CommerceOps AI coordina un equipo de **agentes especializados** en ventas, logística, experiencia de cliente, rendimiento de vendedores, detección de anomalías, machine learning y estrategia empresarial. Un **Evidence Critic** audita y evalúa la evidencia numérica antes de generar el informe final.

### 📋 Estado verificado del sistema

> Última verificación: V4. Las capacidades marcadas como experimentales o parciales no deben interpretarse como producción.
> El dataset Olist cubre principalmente 2016–2018. Las conclusiones son demostrativas y no representan condiciones logísticas actuales.

| Capacidad | Estado verificado | Evidencia |
|---|---|---|
| Orquestación multiagente | ✅ Implementada para demo | LangGraph + pruebas E2E |
| Analytics SQL | ✅ Implementada | PostgreSQL + endpoints deterministas |
| Predictor de atrasos | 🧪 Experimental y bloqueado | Quality gate y Model Card |
| Selección de champion | ✅ Implementada | Walk-forward CV; Logistic/XGBoost |
| Escenarios Data Science | ✅ Point-in-time snapshots | Contrato V3 y tests de parity |
| Trazabilidad | ✅ Durable | AgentRun/ToolExecution incluso en fallos |
| Evidence Critic | ✅ Grounding estructurado | Auditoría numérica determinista |
| NLP de reseñas | ✅/⚠️ Según artefacto cargado | Manifest y método mostrado |
| CI full-stack | ✅ Verificada | Badge y workflow |

---

## 📌 Estado del Proyecto (MVP)

Este repositorio es un **MVP en desarrollo activo** de una plataforma multiagente para inteligencia operacional de e-commerce.

### ✅ Implementado y Auditado (V2 Critical Hardening)
- **Orquestación Multiagente Real:** Grafo de ejecuciones paralelas coordinado con **LangGraph JS** y **NestJS** (`StateGraph` con `Send`).
- **Gobernanza y Quality Gates de ML:** Evaluación honesta y cronológica del modelo predictivo de atrasos sobre el dataset completo de Olist (~96k+ pedidos) con splits temporales estrictos (Train 70% / Validation 15% / Test 15%). Bloqueo automático por defecto (`HTTP 503 MODEL_NOT_APPROVED`) si el modelo no supera los Quality Gates frente a baselines (Logistic Regression vs XGBoost).
- **Inferencia y Explicabilidad:** Inferencia servida vía bundle unificado `.joblib` con esquemas Pydantic estrictos, calibración Platt y atribución explicable genérica (SHAP para árboles, log-odds para Logistic).
- **Escenarios de Inferencia Reales en Data Science:** Invocación de escenarios de entrega reales sin datos hardcodeados y persistencia en la tabla `ModelPrediction`.
- **Trazabilidad Real End-to-End:** Registro inalterable de ejecuciones de `AgentRun`, `ToolExecution` y `ModelPrediction` eliminando fallbacks sintéticos de tokens o duraciones.
- **Evidence Critic Incorruptible:** Validación determinista Zod y bloqueos forzados si existen errores numéricos o inconsistencias de evidencia.
- **Búsqueda Semántica NLP (SentenceTransformers / TF-IDF):** Búsqueda vectorial sobre reseñas reales de Olist con soporte de filtrado por puntuación (1-5 estrellas), rango de fechas y categorías.
- **Frontend Honesto y Dashboard Visual:** Interfaz web Next.js transparente que muestra el estado real del Quality Gate (`APPROVED_FOR_DEMO` / `EXPERIMENTAL_NOT_APPROVED`) y observabilidad de la trazabilidad.


### 🧠 Selección de Modelos & Decisiones de Arquitectura ML / NLP

#### **1. Estrategia de Carga de Datos para Entrenamiento**
Los scripts de entrenamiento (`scripts/train_delivery_champion.py` y `scripts/generate_review_embeddings.py`) seleccionan la fuente mediante el parámetro `--source database|fixture`. Los artefactos registran `source_type`, checksum y cantidad de filas. Los scripts no cambian silenciosamente de fuente.

#### **2. Selección de Modelo NLP**
Para la búsqueda semántica sobre reseñas de Olist, el modelo se define en el manifest del servicio NLP. Ver el manifest actual en `data/processed/` para el modelo activo. La elección entre modelos compactos y multilingüe depende de los recursos disponibles en el entorno de despliegue.

---

## 🏗️ Arquitectura y Flujo de Trabajo Multiagente

```mermaid
flowchart TD
    User["Usuario / Dashboard (Next.js)"] -->|1. Pregunta + Filtros| Gateway["NestJS API Gateway"]
    Gateway -->|2. Iniciar Investigación + SSE| Orchestrator["Orquestador LangGraph"]
    
    subgraph MultiAgentGraph["Grafo Multiagente de Investigación"]
        Orchestrator --> Supervisor["Supervisor Agent"]
        
        Supervisor -->|Plan & Fan-out| Sales["Sales Agent"]
        Supervisor -->|Plan & Fan-out| Logistics["Logistics Agent"]
        Supervisor -->|Plan & Fan-out| CX["Customer Experience Agent"]
        Supervisor -->|Plan & Fan-out| Seller["Seller Performance Agent"]
        Supervisor -->|Plan & Fan-out| Anomaly["Anomaly Detection Agent"]
        Supervisor -->|Plan & Fan-out| DS["Data Science Agent"]
        
        Sales -->|Tools SQL| Database[("PostgreSQL 16")]
        Logistics -->|Tools SQL| Database
        CX -->|Tools SQL / NLP| Database
        Seller -->|Scorecards & Risk| Database
        Anomaly -->|Z-Score Robusto| Database
        DS -->|Feature snapshots point-in-time| MLService["FastAPI ML Service (Experimental)"]
        
        Sales -->|Hallazgos + Evidencia| Critic["Evidence Critic Agent"]
        Logistics -->|Hallazgos + Evidencia| Critic
        CX -->|Hallazgos + Evidencia| Critic
        Seller -->|Hallazgos + Evidencia| Critic
        Anomaly -->|Hallazgos + Evidencia| Critic
        DS -->|Hallazgos + Evidencia| Critic
        
        Critic -->|REQUIRES_MORE_ANALYSIS| Supervisor
        Critic -->|APPROVED| Strategy["Business Strategy Agent"]
        Strategy -->|Recomendaciones Accionables| FinalReport["Informe Ejecutivo Final"]
    end
    
    FinalReport -->|3. Persistir Resultados| Gateway
    Gateway -->|4. Streaming SSE + Reporte| User
```

---

## 🤖 Catálogo de Agentes Especializados

| Agente | Nombre | Rol y Responsabilidades | Herramientas Principales |
|---|---|---|---|
| 👑 **Operations Supervisor** | `SUPERVISOR` | Orquestador principal. Analiza la consulta inicial y construye el plan fan-out. | Selección dinámica de agentes |
| 📊 **Sales Intelligence** | `SALES` | Analiza ingresos, volumen de pedidos, ticket promedio, facturación por categoría, métodos de pago y tendencia AOV. | `get_revenue_summary`, `get_sales_by_category`, `get_sales_by_payment_method`, `get_average_order_value_trend` |
| 🚚 **Logistics Agent** | `LOGISTICS` | Investiga tasas de retraso en entregas, tiempos de transporte, rendimiento por rutas y desglose preparación vs tránsito. | `get_delivery_summary`, `get_delivery_prediction_scenarios`, `get_delivery_performance_by_route`, `get_delivery_stage_breakdown` |
| ⭐ **Customer Experience** | `CUSTOMER_EXPERIENCE` | Analiza calificaciones (1-5 estrellas), distribución de reseñas y búsqueda semántica con filtros. | `get_rating_summary`, `search_reviews_semantic` |
| 🏪 **Seller Performance** | `SELLER_PERFORMANCE` | Genera scorecards operacionales por vendedor y evalúa riesgo acumulado por pedido único. | `get_seller_scorecard` |
| 🚨 **Anomaly Detection** | `ANOMALY` | Aplica Z-Score robusto (mediana + MAD) en series temporales para detectar desviaciones atípicas. | `detect_metric_anomalies` |
| 🧪 **Data Science Agent** | `DATA_SCIENCE` | Modela y predice riesgos operacionales usando el champion actual (genérico: Logistic o XGBoost). Usa snapshots point-in-time y el contrato de features V3. | `predict_delivery_delay`, `explain_delivery_delay` |
| ⚖️ **Evidence Critic** | `CRITIC` | Audita la calidad y consistencia entre las evidencias SQL/ML y las conclusiones mediante gates deterministas incorruptibles. | `performDeterministicAudit`, `enforceDeterministicDecision` |
| 💡 **Business Strategy** | `STRATEGY` | Traduce los hallazgos validados en plan de acción operativo con prioridades e impacto estimado. | Generación de recomendaciones estratégicas |

---

## 🛠️ Stack Tecnológico

- **Backend Gateway:** NestJS (TypeScript, Swagger, RxJS)
- **Multiagent Orchestration:** LangGraph JS, LangChain Core, OpenAI GPT-4o / GPT-4o-mini
- **Base de Datos & ORM:** PostgreSQL 16, Prisma ORM
- **ML & NLP Service:** Python 3.11, FastAPI, Scikit-Learn, XGBoost, SHAP, Sentence-Transformers
- **Frontend App:** Next.js (App Router), React, CSS Vanilla
- **Monorepo & Build:** Turborepo, Docker Compose

---

## 📂 Estructura del Monorepo

```text
commerceOpsAi/
├── apps/
│   ├── api/                    ← NestJS Gateway & LangGraph Orchestrator (Puerto 3001)
│   ├── web/                    ← Next.js Frontend Dashboard (Puerto 3000)
│   └── ml-service/             ← FastAPI Python ML & NLP Service (Puerto 8000)
├── packages/
│   ├── shared-types/           ← Tipos e interfaces TypeScript compartidas
│   ├── agent-contracts/        ← Contratos y permisos de agentes
│   ├── evaluation/             ← Framework de benchmarks y métricas
│   └── observability/          ← Métricas de ejecución
├── data/
│   ├── raw/                    ← Dataset Olist CSV (vía script de descarga/validación)
│   ├── fixtures/               ← Subconjuntos de prueba (~1000 pedidos)
│   └── models/                 ← Modelos ML serializados
├── prisma/
│   └── schema.prisma           ← Esquema de base de datos relacional
├── scripts/
│   ├── validate-dataset.py     ← Script de validación de integridad del dataset
│   ├── import-olist.ts         ← Importación masiva a PostgreSQL
│   ├── create-fixtures.ts      ← Generador de subconjuntos de prueba
│   └── seed-evaluations.ts     ← Runner de suite de benchmarks
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
- Node.js >= 20.x
- Python >= 3.11
- Docker Desktop

---

### 1. Configurar Variables de Entorno
Copia `.env.example` a `.env`:
```bash
Copy-Item .env.example .env
```
*(Configura tu `OPENAI_API_KEY` en `.env`)*.

---

### 2. Iniciar Servicios en Docker
```bash
docker-compose up -d postgres redis
```

---

### 3. Migraciones, Importación y Generación de Artefactos ML/NLP
```bash
# Generar Cliente Prisma
npm run db:generate

# Aplicar migraciones
npm run db:migrate

# Validar dataset e importar (requiere descargar CSVs a data/raw/)
npm run data:validate
npm run db:seed

# Generar artefactos de ML
python scripts/train_delivery_champion.py
python scripts/generate_review_embeddings.py --source database
```

---

### 4. Iniciar Servicios en Modo Desarrollo

Para ejecutar el ecosistema completo (Frontend, API Gateway y Microservicio ML):

```bash
# Terminal 1 — Iniciar Frontend (Next.js) y API Gateway (NestJS):
npm run dev

# Terminal 2 — Iniciar Microservicio ML & NLP (FastAPI Python):
npm run dev:ml
```

> 🌐 **SERVICIOS DISPONIBLES EN EL NAVEGADOR:**
> - 💻 **Frontend Dashboard (Next.js):** [http://localhost:3000](http://localhost:3000)
> - 📚 **Documentación API Gateway (Swagger):** [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
> - 🐍 **Microservicio ML & NLP (FastAPI):** Disponible en el puerto 8000 en desarrollo local (ver `.env.example` para configuración)

---

## 🔐 Autenticación API (Demo)

Las rutas de modificación / inicio de investigación (`POST /api/investigations`) requieren autenticación JWT:

```bash
# 1. Obtener JWT Token con credenciales demo:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@commerceops.ai", "password": "demo123"}'

# 2. Iniciar investigación usando el token recibido:
curl -X POST http://localhost:3001/api/investigations \
  -H "Authorization: Bearer <TU_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Por qué aumentaron las entregas tardías en la categoría muebles durante febrero de 2018?"}'
```

---

## 💡 Preguntas de Ejemplo para Probar el Sistema

Puedes copiar y probar cualquiera de las siguientes preguntas en el Dashboard (`http://localhost:3000/investigations`) o enviarlas a través del API REST (`POST /api/investigations`). 

Cada consulta activa dinámicamente una combinación diferente de agentes especialistas, ejecuta consultas deterministas en PostgreSQL/ML y genera recomendaciones accionables auditadas por el **Evidence Critic**.

### 🚚 1. Logística y SLA de Entregas
> **Pregunta:** `¿Por qué aumentaron las entregas tardías en la categoría muebles durante febrero de 2018?`
- **Agentes Invocados:** `LOGISTICS`, `SELLER_PERFORMANCE`, `ANOMALY`, `CRITIC`, `STRATEGY`
- **Lo que evalúa:** Mide el impacto del tiempo de preparación del vendedor frente al tiempo en tránsito de transportistas en la categoría muebles.
- **Resultado Esperado:** Detección de picos en la tasa de atrasos y clasificación de cuellos de botella por estado.

> **Pregunta:** `¿Cuáles son las rutas interestatales con mayor tasa de atrasos en entregas?`
- **Agentes Invocados:** `LOGISTICS`, `ANOMALY`, `CRITIC`
- **Lo que evalúa:** Comparativa regional de SLAs de entrega por origen (vendedor) y destino (cliente).

---

### ⭐ 2. Satisfacción del Cliente y Experiencia (CX)
> **Pregunta:** `¿Por qué disminuyó la calificación promedio de los clientes en febrero de 2018?`
- **Agentes Invocados:** `CUSTOMER_EXPERIENCE`, `LOGISTICS`, `SALES`, `CRITIC`, `STRATEGY`
- **Lo que evalúa:** Correlación entre la caída en estrellas (1-5) y el incremento de demoras logísticas.
- **Resultado Esperado:** Búsqueda semántica sobre comentarios en portugués y hallazgos con nivel de confianza.

> **Pregunta:** `¿Cuáles son las quejas principales en las reseñas de 1 estrella sobre la categoría informatica_acessorios?`
- **Agentes Invocados:** `CUSTOMER_EXPERIENCE`, `CRITIC`
- **Lo que evalúa:** Análisis de sentimientos y clasificación de temas sobre reseñas con bajas calificaciones.

---

### 📊 3. Ventas, Facturación y Métodos de Pago
> **Pregunta:** `¿Cuáles son las 5 categorías que concentran mayores ingresos y cómo varió su ticket promedio?`
- **Agentes Invocados:** `SALES`, `CRITIC`
- **Lo que evalúa:** Agregaciones financieras directas en SQL para identificar las categorías más rentables del marketplace.

> **Pregunta:** `¿Cuál es la diferencia en volumen de ventas e ingresos entre pagos con tarjeta de crédito y boleto bancario?`
- **Agentes Invocados:** `SALES`, `CRITIC`
- **Lo que evalúa:** Análisis de distribución de métodos de pago y cantidad de cuotas.

---

### 🏪 4. Evaluación de Riesgo de Vendedores
> **Pregunta:** `Evalúa el riesgo operacional y rendimiento acumulado del vendedor con mayores ventas.`
- **Agentes Invocados:** `SELLER_PERFORMANCE`, `LOGISTICS`, `CUSTOMER_EXPERIENCE`, `STRATEGY`
- **Lo que evalúa:** Generación de scorecard de vendedor (tasa de entregas a tiempo, facturación total, rating promedio) y clasificación de riesgo (`HIGH` / `LOW`).

---

### 🧪 5. Machine Learning Predictivo y Gobernanza ML
> **Pregunta:** `¿Cuál es la probabilidad predictiva de atraso en envíos interestatales, el estado de gobernanza del modelo y los factores SHAP de mayor impacto?`
- **Agentes Invocados:** `DATA_SCIENCE`, `LOGISTICS`, `ANOMALY`, `CRITIC`, `STRATEGY`
- **Lo que evalúa:** Inferencia sobre escenarios representativos reales en FastAPI (`/models/delivery-delay/predict`), atribución explicable (SHAP para árboles, log-odds para Logistic) y reflejo transparente del estado del Quality Gate (`EXPERIMENTAL_NOT_APPROVED`).

> **Pregunta:** `¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?`
- **Agentes Invocados:** `CUSTOMER_EXPERIENCE`, `LOGISTICS`, `CRITIC`, `STRATEGY`
- **Lo que evalúa:** Búsqueda semántica sobre comentarios reales de Olist en portugués enviando filtros por puntuación de estrellas (1-5), fechas y categorías al microservicio NLP.

> **Pregunta:** `Detecta desviaciones o picos anómalos en la tasa de retraso de entregas mediante Z-Score robusto.`
- **Agentes Invocados:** `ANOMALY`, `LOGISTICS`, `CRITIC`
- **Lo que evalúa:** Aplicación de Z-Score robusto (Mediana + MAD) sobre la serie temporal filtrada.


---

## 🧠 Data Science, gobernanza y defensa del modelo

El predictor de atrasos es experimental y permanece bloqueado cuando no supera los quality gates. El repositorio documenta tanto los resultados como las razones para no desplegarlo.

- [Model Card](docs/data-science/MODEL_CARD.md)
- [Validación temporal](docs/data-science/TEMPORAL_VALIDATION_REPORT.md)
- [Drift](docs/data-science/DRIFT_ANALYSIS.md)
- [Análisis de errores](docs/data-science/ERROR_ANALYSIS.md)
- [Preguntas y respuestas para defensa técnica](docs/data-science/MODEL_DEFENSE_QA.md)
- [Invariantes del sistema](docs/engineering/INVARIANTS.md)

La misma defensa se encuentra disponible de forma interactiva en **Dashboard → Gobernanza ML → Defensa Data Scientist**.

> El dataset Olist cubre principalmente 2016–2018. Las conclusiones son demostrativas y no representan condiciones logísticas actuales.

---

## 🧪 Evaluaciones Comparativas

Para ejecutar la suite de evaluación y verificar la precisión del enfoque multiagente frente a single-agent:

```bash
npx ts-node --transpile-only -O '{"module":"commonjs"}' scripts/seed-evaluations.ts
```

---

## 📄 Licencia y Atribución
Este proyecto utiliza el dataset público **Brazilian E-Commerce Public Dataset by Olist** publicado en Kaggle bajo Licencia CC BY-NC-SA 4.0.
