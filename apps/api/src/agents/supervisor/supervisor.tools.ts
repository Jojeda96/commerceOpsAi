import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createSupervisorTools(prisma: PrismaService) {
  const getDatasetCoverage = tool(
    async ({ entity }) => {
      if (entity === 'orders' || entity === 'all') {
        const result = await prisma.olistOrder.aggregate({
          _min: { orderPurchaseTimestamp: true },
          _max: { orderPurchaseTimestamp: true },
          _count: { id: true },
        });
        return JSON.stringify({
          entity: 'orders',
          minDate: result._min.orderPurchaseTimestamp?.toISOString().split('T')[0],
          maxDate: result._max.orderPurchaseTimestamp?.toISOString().split('T')[0],
          totalRows: result._count.id,
          availableFields: [
            'order_status',
            'order_purchase_timestamp',
            'order_approved_at',
            'order_delivered_carrier_date',
            'order_delivered_customer_date',
            'order_estimated_delivery_date',
          ],
        });
      }

      return JSON.stringify({
        entity,
        status: 'available',
        message: 'Dataset disponible de septiembre 2016 a octubre 2018.',
      });
    },
    {
      name: 'get_dataset_coverage',
      description: 'Determina qué periodos, entidades y campos están disponibles en el dataset de Olist.',
      schema: z.object({
        entity: z.string().default('orders').describe('Entidad a consultar (ej: orders, sellers, reviews)'),
      }),
    }
  );

  const resolveBusinessEntities = tool(
    async ({ categoryName, sellerAlias, stateName }) => {
      const results: Record<string, unknown> = {};

      if (categoryName) {
        const matches = await prisma.productCategoryTranslation.findMany({
          where: {
            OR: [
              { productCategoryName: { contains: categoryName, mode: 'insensitive' } },
              { productCategoryNameEnglish: { contains: categoryName, mode: 'insensitive' } },
            ],
          },
          take: 5,
        });
        results.categoriesFound = matches;
      }

      if (stateName) {
        results.stateResolved = stateName.toUpperCase();
      }

      return JSON.stringify(results);
    },
    {
      name: 'resolve_business_entities',
      description: 'Convierte nombres de categorías, vendedores o estados ingresados por el usuario en identificadores internos.',
      schema: z.object({
        categoryName: z.string().optional().describe('Nombre de categoría en español, inglés o portugués'),
        sellerAlias: z.string().optional().describe('Alias o ID aproximado de vendedor'),
        stateName: z.string().optional().describe('Nombre o sigla de estado (ej: SP, Rio de Janeiro)'),
      }),
    }
  );

  return [getDatasetCoverage, resolveBusinessEntities];
}
