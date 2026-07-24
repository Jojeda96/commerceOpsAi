# Catálogo de Herramientas Deterministas — CommerceOps AI

Todas las métricas y cálculos en **CommerceOps AI** provienen de herramientas deterministas (consultas SQL en PostgreSQL o modelos de ML/NLP en FastAPI Python). Los agentes de Inteligencia Artificial ejecutan estas herramientas y razonan sobre sus resultados, garantizando cero alucinaciones numéricas.

---

## 🛠️ Herramientas por Agente

### 👑 Operations Supervisor Agent (`SUPERVISOR`)
- **`get_dataset_coverage`**: Consulta el rango de fechas disponibles, total de pedidos y cobertura de datos en PostgreSQL.
- **`resolve_business_entities`**: Mapea identificadores de vendedores, categorías de productos (Portugués -> Inglés) y códigos de estados geográficos (UF).

---

### 📊 Sales Intelligence Agent (`SALES`)
- **`get_revenue_summary`**: Calcula facturación bruta (`SUM(price)`), flete total (`SUM(freight_value)`), volumen de órdenes, total de ítems y ticket promedio (`AOV`).
- **`get_sales_by_category`**: Agrupa facturación, unidades vendidas y número de pedidos agrupados por categoría de producto.

---

### 🚚 Logistics Agent (`LOGISTICS`)
- **`get_delivery_summary`**: Calcula métricas de SLA logístico: total pedidos entregados, pedidos atrasados, tasa de retraso (`lateRate %`), días promedio de tránsito y días promedio de demora.
- **`compare_delivery_periods`**: Compara métricas de entrega entre dos periodos de tiempo (ej. Feb 2018 vs Feb 2017).

---

### ⭐ Customer Experience Agent (`CUSTOMER_EXPERIENCE`)
- **`get_rating_summary`**: Calcula la distribución de calificaciones (1 a 5 estrellas), rating promedio (CSAT), total de reseñas y porcentaje de reseñas de 1 estrella.
- **`search_reviews_semantic`**: Ejecuta búsqueda semántica NLP y agrupamiento de temas sobre reseñas en portugués mediante embeddings (`paraphrase-multilingual-MiniLM-L12-v2`) en el microservicio FastAPI.

---

### 🏪 Seller Performance Agent (`SELLER_PERFORMANCE`)
- **`get_seller_scorecard`**: Genera una tarjeta de rendimiento operativo para un vendedor específico (pedidos entregados, facturación acumulada, tasa de atrasos y calificación promedio).
- **`rank_sellers_by_risk`**: Clasifica a los vendedores por nivel de riesgo operacional (`HIGH` / `LOW`) según su tasa de atrasos y rating de clientes.

---

### 🚨 Anomaly Detection Agent (`ANOMALY`)
- **`detect_metric_anomalies`**: Aplica algoritmo de **Z-Score Robusto** e **Isolation Forest** para detectar desviaciones estadísticas en costo de flete, ventas o picos anómalos de reclamos.
- **`detect_freight_outliers`**: Identifica pedidos donde el valor del flete representa un porcentaje desproporcionado respecto al precio del producto.

---

### 🧪 Data Science Agent (`DATA_SCIENCE`)
- **`predict_delivery_delay`**: Ejecuta inferencia predictiva con algoritmo **XGBoost** en FastAPI Python para predecir la probabilidad matemática de retraso de un pedido o ruta.
- **`explain_prediction`**: Retorna los valores de importancia de variables **SHAP (SHapley Additive exPlanations)** mostrando qué características contribuyeron más a la predicción de retraso.

---

### ⚖️ Evidence Critic Agent (`CRITIC`)
- **`validate_finding_evidence`**: Audita la correspondencia 1:1 entre las afirmaciones hechas por los agentes y las evidencias numéricas registradas por las herramientas SQL en PostgreSQL.
- **`check_causal_language`**: Modera afirmaciones causales no respaldadas por evidencia estadística.

---

### 💡 Business Strategy Agent (`STRATEGY`)
- **`prioritize_recommendations`**: Clasifica las recomendaciones operativas por nivel de prioridad (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) e impacto.
- **`estimate_historical_impact`**: Simula el impacto de negocio proyectado (escenario *"What-If"*) al corregir el cuello de botella identificado.
