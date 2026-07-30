# Definición del Problema — Predictor de Atrasos

## Problema de negocio

Los retrasos en la entrega de pedidos de e-commerce generan:
- Reseñas negativas que afectan la reputación del seller.
- Solicitudes de devolución y reembolso.
- Pérdida de clientes recurrentes.
- Costos de atención al cliente.

**Objetivo:** Identificar pedidos con alta probabilidad de atraso en el momento de la compra (ORDER_PURCHASE) para habilitar intervenciones operativas tempranas.

## Formulación ML

| Campo | Valor |
|---|---|
| Tipo de tarea | Clasificación binaria |
| Variable objetivo | `is_delayed = (delivered_date > estimated_date)` |
| Momento de predicción | `ORDER_PURCHASE` |
| Salida del modelo | Probabilidad calibrada P(is_delayed = 1 \| features) |

## Por qué formulación binaria y no regresión

La regresión de días de retraso requiere conocer cuántos días después se entregará el pedido, lo que implica conocer la fecha de entrega real (leakage). La formulación binaria solo requiere saber si el pedido llegará dentro de la ventana prometida, que es verificable con datos históricos point-in-time.

## Restricciones del prediction moment

Solo pueden usarse features disponibles en `ORDER_PURCHASE`:

- ✅ Precio, peso, volumen del pedido al momento de compra
- ✅ Ventana de envío estimada (last_shipping_limit - purchase_date)
- ✅ Historial de seller/ruta/categoría hasta la fecha de compra
- ✅ Datos temporales (día de semana, hora, mes, semana)
- ❌ Fecha de entrega al carrier (ocurre después)
- ❌ Fecha de entrega al cliente (ocurre después)
- ❌ Reseñas del pedido actual (generadas post-entrega)

## Baseline de negocio

Sin modelo, la tasa de atrasos histórica es ~6.6%. Una intervención sin modelo que notifique a todos los sellers tiene precision = 6.6%. El modelo debe superar esta precisión en los casos de alta prioridad.

## Métrica de éxito operativo

Para ser útil operativamente, el modelo debe tener un **lift de Precision@K ≥ 1.5x** sobre prevalencia en el top 5% de pedidos rankeados por riesgo. Esto significa que en los 723 pedidos más riesgosos (top 5% de ~14K), al menos 15% deberían ser retrasos reales.

**Estado actual:** Lift de 1.055x — no alcanza el threshold operativo.
