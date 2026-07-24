# Catálogo de Agentes — CommerceOps AI

| Agente | Nombre Interno | Rol y Responsabilidades | Herramientas Principales | Permisos |
|---|---|---|---|---|
| **Supervisor** | `SUPERVISOR` | Clasifica intención, genera plan y coordina fan-out | `get_dataset_coverage`, `resolve_business_entities` | Lectura general |
| **Ventas** | `SALES` | Análisis de facturación, ticket promedio, categorías y métodos de pago | `get_revenue_summary`, `get_sales_by_category` | Lectura ventas |
| **Logística** | `LOGISTICS` | Tasa de atrasos, tiempos de transporte, fletes y SLAs por región | `get_delivery_summary` | Lectura logística |
| **Experiencia Cliente** | `CUSTOMER_EXPERIENCE` | Calificaciones (1-5 estrellas), distribución y análisis de reseñas | `get_rating_summary` | Lectura reseñas |
| **Vendedores** | `SELLER_PERFORMANCE` | Scorecards de vendedores, riesgo operacional y comparaciones entre pares | `get_seller_scorecard` | Lectura vendedores |
| **Anomalías** | `ANOMALY` | Detección de outliers de flete, z-score robusto y desviaciones bruscas | `detect_metric_anomalies` | Lectura + ML |
| **Data Science** | `DATA_SCIENCE` | Modelos predictivos de atrasos, probabilidades y explicabilidad SHAP | `predict_delivery_delay` | Lectura + ML |
| **Estrategia** | `STRATEGY` | Transforma hallazgos técnicos en recomendaciones empresariales priorizadas | `prioritize_recommendations` | Escritura recomendaciones |
| **Crítico** | `CRITIC` | Audita la evidencia, detecta alucinaciones y valida hipótesis | `validate_finding_evidence` | Auditoría general |
