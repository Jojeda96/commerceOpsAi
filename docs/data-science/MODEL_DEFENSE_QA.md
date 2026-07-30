# Defensa Data Scientist — Preguntas y Respuestas

> Generado automáticamente desde `data/governance/model_defense_qa.json` el 2026-07-30.
> Las respuestas con métricas actuales se actualizan al regenerar este documento.

**Total:** 40 preguntas en 11 categorías.

---

## Definición del problema

### ¿Qué predice el modelo?

El modelo predice si un pedido será entregado después de la fecha estimada (is_delayed = delivered_date > estimated_date). La salida es una probabilidad calibrada, no un diagnóstico causal. El target es binario: 1 si el pedido llega tarde, 0 si llega a tiempo.

**Evidencia:**
- `data/contracts/delivery_feature_contract.v3.json`

### ¿Por qué este problema importa para el negocio?

Los retrasos en entregas generan reseñas negativas, devoluciones y pérdida de clientes. Identificar pedidos con alta probabilidad de atraso permite priorizar intervenciones operativas (alertas a sellers, cambio de carrier, comunicación proactiva al cliente) antes de que el problema ocurra.

**Evidencia:**
- `docs/data-science/PROBLEM_DEFINITION.md`

### ¿Qué es el dataset Olist y cuáles son sus limitaciones?

El dataset Olist cubre pedidos de e-commerce brasileño entre 2016 y 2018. Es un dataset público de ~100K órdenes con información de compradores, sellers, productos, envíos y reseñas. Limitaciones: es histórico (no hay datos post-2018), es específico de Brasil, no tiene información de carriers en tiempo real, y la distribución de atrasos puede no representar condiciones logísticas actuales.

**Evidencia:**
- `docs/data-science/MODEL_CARD.md`

### ¿Qué evitarías afirmar sobre el modelo en una entrevista?

Evitaría afirmar: (1) que el modelo está listo para producción — está en estado EXPERIMENTAL_NOT_APPROVED; (2) que las métricas de CV representan desempeño real — el gap con test es significativo; (3) que las features SHAP implican causalidad — son correlaciones en el espacio del modelo; (4) que el modelo es transferible a otros mercados — es específico de Olist 2016-2018.

---

## Momento de predicción y leakage

### ¿Cuál es el prediction moment?

ORDER_PURCHASE. Solo se usan features disponibles al momento en que el cliente crea el pedido. Cualquier dato generado después de ese momento (como la fecha de entrega al carrier o la fecha real de entrega) viola el prediction moment y produce leakage.

**Evidencia:**
- `data/contracts/delivery_feature_contract.v3.json`
- `docs/engineering/INVARIANTS.md`

### ¿Qué es leakage point-in-time y cómo lo evitaste?

El leakage point-in-time ocurre cuando se usan en el modelo datos que solo estarían disponibles después del momento de predicción. Por ejemplo, usar la tasa de atraso de un seller calculada sobre pedidos futuros al que se está evaluando. Lo evité usando solo datos históricos cuya fecha de cierre es anterior a la fecha de compra del pedido actual, y creando snapshots point-in-time sincronizados en la tabla delivery_feature_snapshots.

**Evidencia:**
- `scripts/ml/build_delivery_feature_snapshots.py`
- `docs/engineering/INVARIANTS.md`

### ¿Por qué no usas order_delivered_carrier_date como feature?

La fecha de entrega al carrier ocurre DESPUÉS de que el pedido es creado. Usarla como feature del modelo de predicción al momento ORDER_PURCHASE sería leakage directo: el modelo vería información del futuro durante entrenamiento pero no podría verla durante inferencia real. Está explícitamente prohibida en INV-01.

**Evidencia:**
- `docs/engineering/INVARIANTS.md`

---

## Validación temporal

### ¿Por qué no usaste un split aleatorio?

Un split aleatorio mezcla temporalmente órdenes del futuro con el pasado durante el entrenamiento. Esto crea leakage implícito porque las historiales de seller, ruta y categoría usados como features incluirían datos posteriores al pedido evaluado. El resultado son métricas artificialmente infladas que no representan desempeño real en producción.

**Evidencia:**
- `data/models/reports/walk_forward_metrics.json`
- `docs/data-science/TEMPORAL_VALIDATION_REPORT.md`

### ¿Por qué walk-forward CV en lugar de un simple train/val temporal?

Un único split temporal fijo puede tener sesgo por las condiciones específicas de ese período. Walk-forward CV usa múltiples ventanas temporales con entrenamiento creciente, lo que permite estimar la varianza del desempeño, identificar el peor fold, y diagnosticar inestabilidad en diferentes períodos del dataset.

**Evidencia:**
- `data/models/reports/walk_forward_metrics.json`

### ¿Cómo se separa la calibración de la selección de modelo?

El calibrador (Isotonic Regression o Platt) se ajusta en un conjunto de calibración separado de los datos de validación y test. Esto evita que el calibrador memorice las predicciones del modelo en los mismos datos donde fue evaluado, garantizando que las probabilidades calibradas reflejen frecuencias reales.

**Evidencia:**
- `data/models/reports/calibration_report.json`

### ¿Cómo explicas el gap entre validación y test? 🔄

El ROC-AUC en walk-forward CV es 0.7250 mientras que en test final es 0.4528. Este gap puede explicarse por: (1) drift temporal en features históricas (seller_prior_late_rate_smoothed tiene PSI=2.89), (2) variabilidad de prevalencia entre períodos, (3) patrones estacionales específicos del período de test. Este gap es una razón válida para mantener el modelo bloqueado.

**Evidencia:**
- `data/models/reports/walk_forward_metrics.json`
- `data/models/reports/drift_report.json`

---

## Desbalance y métricas

### ¿Por qué accuracy es engañosa con este dataset? 🔄

La prevalencia de pedidos atrasados es aproximadamente 6.6%. Un clasificador trivial que predice 'no atrasado' siempre tendría accuracy ~93%, pero no aportaría ningún valor operativo. Con desbalance, accuracy no discrimina entre un modelo útil y uno inútil.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Por qué PR-AUC importa con ~6-7% de positivos?

PR-AUC (Area Under the Precision-Recall curve) mide qué tan bien el modelo ordena los verdaderos positivos. Con prevalencia baja, un modelo random tiene PR-AUC igual a la prevalencia (~6.6%). Un modelo útil debe superar significativamente este baseline. ROC-AUC es menos sensible al desbalance porque incluye los verdaderos negativos en su denominador.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Qué significa lift sobre prevalencia? 🔄

El lift sobre prevalencia en PR-AUC mide cuántas veces mejor es el modelo respecto a clasificación aleatoria. Un lift de 1.055x significa que la precisión promedio del modelo es 1.055x mayor que la prevalencia base. Para ser operativamente útil, se requiere un lift mínimo de 1.5x sobre prevalencia. El champion actual tiene un lift de 1.055x, que no supera el gate.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`
- `data/contracts/delivery_quality_gates.v3.json`

---

## Selección de modelos

### ¿Por qué Logistic Regression como baseline?

Logistic Regression es el baseline más honesto porque: (1) es interpretable directamente en términos de log-odds, (2) tiene menos hiperparámetros que optimizar, (3) es menos propenso a overfitting con datasets medianos, y (4) sirve como cota inferior realista: si XGBoost no supera a Logistic, no hay ganancia de complejidad justificada.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Por qué XGBoost no gana automáticamente?

XGBoost tiene más capacidad de expresión que Logistic, pero eso no garantiza mejor generalización. Con datasets de tamaño moderado y features de alta varianza (como historiales suavizados), XGBoost puede sobreajustarse más. La selección correcta requiere comparar mediante validación temporal, no asumir superioridad por complejidad.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`
- `data/models/reports/walk_forward_metrics.json`

### ¿Cómo se elige el champion? 🔄

El champion se selecciona por mayor PR-AUC en el conjunto de validación del walk-forward CV. No se usa el test set para selección (INV-05). Actualmente el champion es xgboost_baseline, que tuvo el mejor PR-AUC en CV.

**Evidencia:**
- `data/models/reports/champion_decision.json`

### ¿Qué es worst-fold performance y por qué importa?

El worst-fold es el fold de walk-forward CV con la menor métrica objetivo. Importa porque el desempeño en producción tiende a estar más cerca del peor fold que del promedio. Si el modelo funciona bien en promedio pero muy mal en un período específico, puede ser inestable ante cambios estacionales.

**Evidencia:**
- `data/models/reports/walk_forward_metrics.json`

---

## Calibración y threshold

### ¿Por qué calibrar probabilidades?

Un modelo sin calibración puede tener probabilidades que no reflejan frecuencias reales. Por ejemplo, predecir 0.8 cuando solo el 40% de esos casos son positivos reales. La calibración (Isotonic o Platt) ajusta las probabilidades para que sean estadísticamente interpretables y útiles para decisiones basadas en costos/beneficios.

**Evidencia:**
- `data/models/reports/calibration_report.json`

### ¿Qué es Brier Score? 🔄

Brier Score es el error cuadrático medio de las probabilidades predichas respecto a los labels reales. Un Brier Score de 0 es perfecto, 0.25 equivale a un modelo random con prevalencia 50%. Para prevalencia ~6.6%, el baseline random tiene Brier ~0.066. El champion tiene Brier de 0.0652, que es comparable al baseline.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Cómo se elige el threshold?

El threshold se elige optimizando el F1-score en el conjunto de calibración. Esto es diferente a fijarlo en 0.5 arbitrariamente. Con prevalencia baja, un threshold más bajo (como 0.09 en el champion) puede maximizar recall a costa de precision, dependiendo del contexto de negocio (costo relativo de falsos positivos vs. falsos negativos).

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Cambiar el threshold cambia ROC-AUC?

No. ROC-AUC es independiente del threshold — mide el área bajo la curva que evalúa todos los thresholds posibles. Cambiar el threshold solo modifica el punto de operación actual en esa curva (precision, recall, F1). ROC-AUC es una propiedad del modelo, no del threshold elegido.

---

## Drift y generalización

### ¿Qué drift se encontró entre entrenamiento y test?

El reporte de drift identifica varias features con drift HIGH (PSI > 0.2): total_freight (PSI=0.307), estimated_delivery_days (PSI=0.455), shipping_window_days (PSI=0.29), purchase_month (PSI=14.5), seller_prior_late_rate_smoothed (PSI=2.89), route_prior_late_rate_smoothed (PSI=1.67), category_prior_late_rate_smoothed (PSI=9.21). El drift temporal en las historiales suavizadas sugiere que el período de test tuvo patrones logísticos diferentes al de entrenamiento.

**Evidencia:**
- `data/models/reports/drift_report.json`

### ¿El drift HIGH en una feature demuestra que causó el gap?

No. El drift identifica diferencias distribucionales entre entrenamiento y test, pero no establece causalidad. Una feature con drift HIGH puede ser un proxy de otra variable latente, o el drift puede existir sin impactar las predicciones si la feature tiene baja importancia para el modelo en ese rango de valores.

**Evidencia:**
- `data/models/reports/drift_report.json`

### ¿Hay categorías o rutas no vistas en test?

Sí. El reporte de categorías no vistas indica que existen rutas (route_pair) y categorías (primary_category) presentes en test que no aparecieron durante entrenamiento. La tasa de unseen es baja (~0.08-0.2%), pero estos casos serán manejados por el imputer del pipeline en producción.

**Evidencia:**
- `data/models/reports/unseen_categories_report.json`
- `data/models/reports/drift_report.json`

---

## Interpretabilidad

### ¿SHAP demuestra causalidad?

No. SHAP (SHapley Additive exPlanations) mide la contribución marginal promedio de cada feature a la predicción del modelo, en la escala de log-odds para modelos de árbol. Es una medida de importancia relativa dentro del modelo, no de causalidad entre features y delays. Una feature con SHAP alto puede ser proxy de otra variable latente.

**Evidencia:**
- `docs/data-science/MODEL_CARD.md`

### ¿Cómo se explican modelos lineales si SHAP-Tree no aplica?

Para Logistic Regression se usa la contribución de log-odds: contribution_i = x_i * coef_i (donde x_i es el valor transformado por el preprocessor). La suma de todas las contribuciones más el intercepto es el log-odds final. Esto se llama LINEAR_LOG_ODDS_CONTRIBUTION en el adapter genérico del ML service.

**Evidencia:**
- `apps/ml-service/app/services/model_adapters/linear.py`

### ¿Qué mostró el análisis de ablation?

El ablation study evaluó subconjuntos de features de menor a mayor complejidad (experimentos A a G). Los resultados muestran que las historiales de seller y ruta (experimentos D y E) son las que más mejoran el PR-AUC. El experimento G con todas las features categóricas tiene el mejor resultado, confirmando que la información de seller, ruta y categoría son necesarias para el desempeño actual.

**Evidencia:**
- `data/models/reports/ablation_report.json`
- `docs/data-science/ABLATION_REPORT.md`

---

## Gobernanza y despliegue

### ¿Qué quality gates existen?

Los quality gates V3 requieren: ROC-AUC ≥ 0.60 en test, PR-AUC lift sobre prevalencia ≥ 1.5x, Recall ≥ 0.50 en test, Precision ≥ 0.15 en test, y que el champion supere al mejor Logistic Regression por un margen mínimo en PR-AUC. Estos gates son evaluados automáticamente por ModelGovernance y determinan el deployment_status.

**Evidencia:**
- `data/contracts/delivery_quality_gates.v3.json`
- `apps/ml-service/app/services/model_governance.py`

### ¿Por qué bloquear un modelo es un resultado válido?

Bloquear un modelo que no generaliza es el resultado correcto de un proceso de gobernanza responsable. La alternativa — desplegar un modelo experimental con métricas insuficientes — podría generar decisiones operativas incorrectas y pérdida de confianza. El estado EXPERIMENTAL_NOT_APPROVED no es un fracaso del proyecto; es evidencia de que el sistema de gobernanza funciona.

**Evidencia:**
- `docs/engineering/INVARIANTS.md`
- `apps/ml-service/app/services/model_governance.py`

### ¿Qué uso está permitido para un modelo experimental?

Un modelo en estado EXPERIMENTAL_NOT_APPROVED puede usarse para: análisis exploratorio bajo supervisión humana, comparación de metodologías durante desarrollo, demostración de capacidades técnicas en contexto de portafolio, y priorización manual de órdenes para investigación adicional. No puede usarse para decisiones operativas automáticas ni comunicación de probabilidades a clientes como garantía.

**Evidencia:**
- `docs/data-science/MODEL_CARD.md`

### ¿Cuál es el estado actual del quality gate? 🔄

El estado actual es EXPERIMENTAL_NOT_APPROVED. El champion xgboost_baseline tiene ROC-AUC test de 0.4528 y PR-AUC test de 0.0698. Las razones del bloqueo son: ROC-AUC inferior a 0.60, lift de PR-AUC insuficiente, recall inferior a 0.50, y precision inferior a 0.15.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

---

## Impacto de negocio

### ¿Cómo traducirías el modelo a impacto de negocio?

Si el modelo alcanzara un lift de 1.5x en producción: de los top 5% de pedidos rankeados por riesgo (~723 pedidos en el test), detectaría ~10% de los retrasos reales con precisión ~10%. Para comunicar impacto: 'En un dataset de 14K pedidos, el modelo puede priorizar correctamente 72 de ~957 pedidos atrasados en el top 5% de la lista de riesgo'. Actualmente el lift es 1.055x, que no justifica costos operativos de intervención.

**Evidencia:**
- `data/models/delivery_delay_metrics.json`

### ¿Cómo evalúas falsos positivos vs falsos negativos?

Depende del costo de cada error en el contexto de negocio. Un falso positivo (predecir atraso cuando llegará a tiempo) genera una intervención innecesaria (costo operativo, posible contacto al cliente sin necesidad). Un falso negativo (no detectar un atraso real) significa que el retraso ocurre sin intervención. Si la intervención es barata y el daño del atraso es alto, se puede tolerar más falsos positivos con recall más alto.

---

## Limitaciones y próximos pasos

### ¿Qué información adicional ayudaría?

Datos que mejorarían el modelo: (1) información del carrier asignado por zona, (2) volumen y capacidad operativa del seller, (3) condiciones climáticas por región, (4) eventos especiales (Black Friday, feriados), (5) datos de tracking de paquetes en tiempo real, (6) historial de incidencias logísticas del carrier. Con más datos de contexto logístico, el modelo podría capturar patrones que hoy quedan en el ruido.

### ¿Qué limitaciones tiene el dataset Olist 2016-2018?

El dataset Olist tiene las siguientes limitaciones conocidas: (1) cubre solo hasta 2018 — las condiciones logísticas han cambiado; (2) es específico del e-commerce brasileño; (3) no incluye información del carrier (solo la fecha límite de shipping); (4) el seller_id no tiene información de capacidad; (5) las categorías de productos pueden no mapear a categorías actuales de negocio; (6) la tasa de atrasos fue inusualmente alta en 2018-Q2 por factores externos (huelgas de camioneros).

**Evidencia:**
- `docs/data-science/MODEL_CARD.md`
- `docs/engineering/V4_BASELINE.md`

### ¿Cómo aseguras training-serving parity?

La parity se garantiza por: (1) un contrato único de features en delivery_feature_contract.v3.json que es validado tanto en training como en inferencia; (2) el mismo builder de features (delivery_feature_builder.py) procesa tanto datos históricos como requests de inferencia; (3) el bundle almacena raw_features en el mismo orden que el modelo fue entrenado; (4) tests automatizados verifican que el contrato coincida con el bundle y los metrics JSON.

**Evidencia:**
- `data/contracts/delivery_feature_contract.v3.json`
- `scripts/contracts/validate_delivery_contract.py`
- `apps/ml-service/app/services/delivery_feature_builder.py`

### ¿Cómo reproducirías los resultados?

Los resultados son reproducibles siguiendo: (1) usar el mismo SHA base (3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606); (2) ejecutar con random_seed=42; (3) usar el dataset manifest con checksum verificado; (4) ejecutar python scripts/train_delivery_champion.py; (5) los checksums de artefactos están documentados en docs/engineering/V4_BASELINE.md.

**Evidencia:**
- `docs/engineering/V4_BASELINE.md`
- `docs/data-science/REPRODUCIBILITY.md`

### ¿Qué harías si ningún modelo supera los gates?

Si ningún modelo supera los quality gates: (1) documentar honestamente el estado EXPERIMENTAL_NOT_APPROVED como resultado válido; (2) realizar análisis de error para identificar patrones de fallos sistemáticos; (3) evaluar si los quality gates son apropiados para el dataset actual; (4) investigar features adicionales; (5) considerar framing del problema alternativo (regresión de días de retraso en lugar de clasificación binaria). No bajar los thresholds de los gates para hacer pasar un modelo que no generaliza.

**Evidencia:**
- `data/contracts/delivery_quality_gates.v3.json`
- `docs/engineering/INVARIANTS.md`

### ¿Cuándo reentrenarías el modelo?

Triggers de reentrenamiento: (1) PSI > 0.2 en features críticas (drift HIGH detectado); (2) ROC-AUC en ventana de monitoreo baja más de 0.05 respecto al baseline; (3) cambio estructural en la cadena logística (nuevo carrier, nueva zona geográfica); (4) cambio en la definición del target o en los quality gates; (5) nueva información disponible que mejore las features (e.g., datos de carrier).

**Evidencia:**
- `docs/data-science/MODEL_CARD.md`

---
